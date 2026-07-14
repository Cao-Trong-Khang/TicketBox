# Đặc tả: AI Artist Bio

## Mô tả

Tính năng cho organizer tạo tiểu sử nghệ sĩ tiếng Việt từ press kit PDF, lưu tài liệu trong MinIO, chuyển job qua Kafka và lưu text/bio/trạng thái trong PostgreSQL. Organizer xem, sửa, xóa hoặc tạo lại bio; catalog công khai đọc bản `DONE` mới nhất.

## Luồng chính

1. Preview `POST /admin/artist-bio/preview` nhận PDF và `previous_bio`, trích text rồi gọi AI đồng bộ, không lưu tài liệu.
2. Upload theo concert yêu cầu JWT, permission `concert:update`, role organizer và ownership. Concert phải chưa bị hủy và chưa tới giờ biểu diễn khi thực hiện mutation.
3. Backend kiểm tra file name `.pdf`, MIME `application/pdf`, magic bytes `%PDF-` và kích thước tối đa 10 MB.
4. File được lưu MinIO với key `artist-documents/{concertId}/{documentId}.pdf`.
5. Nếu request có `generated_bio` hợp lệ, backend tạo `artist_documents.DONE` và `ai_artist_bios.DONE` trong transaction, rồi xóa cache detail.
6. Nếu không có bio sẵn, backend tạo `artist_documents.UPLOADED`, publish event lên Kafka topic `ai.bio.requested` với key document id và trả HTTP 202.
7. AI worker tạo topic 3 partition/replication 1 khi khởi động, republish document còn `UPLOADED`, subscribe theo group cấu hình và claim document bằng conditional update `UPLOADED -> EXTRACTING`.
8. Worker tải PDF từ MinIO, dùng `pdf-parse` lấy text, làm sạch whitespace/control character, yêu cầu đủ độ dài rồi lưu `EXTRACTED`.
9. Worker chuyển document sang `GENERATING`, upsert bio `GENERATING`, cắt input theo giới hạn và gọi provider cấu hình (`gemini`, `openai` hoặc `mock`).
10. Thành công cập nhật bio `DONE`, document `DONE`, `generatedAt` và xóa cache detail trong transaction.
11. Regenerate tạo document id mới dùng chung storage key, publish event kèm bio trước; update thủ công lưu bio mới và audit log. Xóa document xóa DB/audit trong transaction rồi xóa object nếu không còn document tham chiếu storage key.

## Kịch bản lỗi

- Thiếu file, file quá 10 MB, sai extension/MIME/signature hoặc text trích xuất ngắn hơn ngưỡng trả `400` ở preview/upload tương ứng.
- User không sở hữu concert hoặc thiếu role/permission trả `403`; concert không tồn tại trả `404`.
- Concert cancelled, ongoing hoặc ended không nhận mutation bio và trả `409`.
- MinIO timeout khi worker tải được retry tối đa 3 lần; hết retry làm document/bio thành `FAILED` với failure reason chuẩn hóa.
- AI timeout hoặc rate limit được thử lần hai; lỗi còn lại làm document/bio `FAILED`.
- Kafka publish lỗi sau upload trả `503` và giữ document `UPLOADED` để republish.
- Worker bỏ qua event nếu document không tồn tại, không thuộc concert hoặc không còn `UPLOADED`; conditional claim ngăn hai worker xử lý cùng document.
- Update bio rỗng hoặc chưa có bản bio để sửa trả `400`/`409`.
- Lỗi sau khi upload object nhưng trước khi tạo record làm backend cố xóa object.

## Ràng buộc

- PDF tối đa 10 MB; text sau làm sạch tối thiểu mặc định 50 ký tự.
- AI input tối đa mặc định 4.000 ký tự; manual `generated_bio` tối đa 10.000 ký tự.
- MinIO timeout mặc định 10.000 ms; download retry 3 lần với backoff 500 ms, 1.000 ms.
- AI timeout mặc định 30.000 ms; tối đa 2 lần thử. Retry timeout chờ 500 ms; retry rate limit chờ mặc định 60.000 ms.
- Kafka topic mặc định `ai.bio.requested`, producer dùng `acks=-1`.
- Trạng thái document: `UPLOADED`, `EXTRACTING`, `EXTRACTED`, `GENERATING`, `DONE`, `FAILED`.
- Trạng thái bio: `GENERATING`, `DONE`, `FAILED`; `documentId` là duy nhất.
- Prompt yêu cầu tiếng Việt, chỉ dùng dữ kiện press kit; Gemini thực hiện thêm lượt sửa khi output thiên tiếng Anh hoặc quá giống bio trước.

## Tiêu chí chấp nhận

- **Given** PDF hợp lệ và organizer sở hữu concert, **When** upload không kèm bio, **Then** object và document `UPLOADED` được tạo, event Kafka được publish và response là 202.
- **Given** worker nhận event của document uploaded, **When** pipeline thành công, **Then** text được lưu, document/bio thành `DONE` và bio xuất hiện trong concert detail.
- **Given** hai worker nhận cùng event, **When** cùng claim, **Then** chỉ worker có `updateMany.count = 1` xử lý.
- **Given** MinIO timeout hai lần rồi thành công, **When** worker download, **Then** pipeline tiếp tục ở lần thử thứ ba.
- **Given** AI vẫn lỗi sau retry, **When** worker xử lý catch, **Then** document và bio thành `FAILED` với failure reason.
- **Given** organizer sửa bio đã có, **When** update, **Then** bio mới được lưu `DONE`, cache detail bị xóa và audit log được tạo.
- **Given** regenerate từ document có bio, **When** gọi API, **Then** document mới được tạo và event chứa `previous_bio`.
