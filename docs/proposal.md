# TicketBox — Project Proposal

## Vấn đề

Việc vận hành bán vé concert qua nhiều kênh rời rạc làm khó kiểm soát sức chứa, trạng thái thanh toán, vé điện tử và quyền vào cổng. Tại thời điểm mở bán, nhiều yêu cầu đồng thời còn tạo áp lực lên cơ sở dữ liệu và làm tăng nguy cơ giữ chỗ vượt sức chứa. Ở địa điểm tổ chức, kết nối mạng không ổn định đòi hỏi dữ liệu soát vé và nhật ký quét phải tồn tại ngay trên thiết bị.

TicketBox hợp nhất các công việc đó trong một hệ thống phục vụ ba nhóm người dùng: khán giả, ban tổ chức và nhân viên check-in. Hệ thống quản lý concert và loại vé, tạo đơn giữ chỗ, kết nối thanh toán, phát hành e-ticket có QR, gửi thông báo, nhập khách VIP từ CSV, tạo tiểu sử nghệ sĩ từ PDF và hỗ trợ soát vé ngoại tuyến.

## Mục tiêu

- Xử lý lưu lượng truy cập cao điểm khoảng 80.000 người trong vòng 5 phút, trong đó 70% người dùng truy cập trong phút đầu tiên, mà không làm quá tải các dịch vụ backend quan trọng.
- Bảo vệ các API bán vé khỏi bot, client gửi yêu cầu quá mức và các yêu cầu lặp lại, đồng thời vẫn đảm bảo quyền truy cập công bằng cho người dùng hợp lệ.
- Duy trì khả dụng cho trang danh sách concert công khai và trang chi tiết concert trong điều kiện lưu lượng đọc lớn bằng cách phục vụ dữ liệu cache đủ mới và giảm tải truy vấn trực tiếp đến cơ sở dữ liệu.
- Ngăn chặn bán vượt số lượng và tránh gán trùng vé cuối cùng đối với các hạng vé giới hạn như SVIP, VIP, GA, CAT1 và CAT2.
- Áp dụng giới hạn mua vé có thể cấu hình theo từng người dùng, từng concert và từng loại vé trên toàn bộ các đơn hàng đã thanh toán thành công, bao gồm cả các trường hợp mua đồng thời.
- Tích hợp VNPAY và MoMo an toàn với các lần thanh toán có tính idempotent, xử lý timeout, ngăn thanh toán hai lần và cô lập lỗi để hoạt động duyệt concert không liên quan đến thanh toán vẫn khả dụng khi cổng thanh toán gặp sự cố.
- Gửi vé điện tử có mã QR sau khi thanh toán thành công và thông báo cho người dùng qua thông báo trong ứng dụng và email.
- Gửi nhắc nhở tự động trước mỗi concert 24 giờ và hỗ trợ mở rộng các kênh thông báo trong tương lai như Zalo OA hoặc SMS mà không cần thiết kế lại lớn.
- Áp dụng kiểm soát truy cập theo vai trò để người dùng khán giả, ban tổ chức và nhân viên check-in chỉ có thể truy cập các chức năng phù hợp với vai trò của họ.
- Cung cấp chức năng cho ban tổ chức để thiết lập concert, cấu hình vé, quản lý thời gian mở bán, hủy hoặc cập nhật sự kiện, theo dõi doanh số và doanh thu.
- Cung cấp cho nhân viên check-in quy trình quét vé trên thiết bị di động, hoạt động được trong điều kiện mạng yếu hoặc không ổn định và đồng bộ check-in ngoại tuyến một cách an toàn.
- Hỗ trợ xử lý bất đồng bộ PDF nghệ sĩ hoặc press kit để tạo tiểu sử nghệ sĩ bằng AI, có trạng thái xử lý và hành vi dự phòng khi trích xuất hoặc tạo nội dung bằng AI thất bại.
- Nhập danh sách khách mời VIP từ file CSV của nhà tài trợ theo lịch một cách bất đồng bộ, có xác thực dữ liệu, loại bỏ trùng lặp, báo lỗi và không làm gián đoạn hoạt động bán vé hoặc check-in trực tiếp.

## Người dùng và nhu cầu

- **Khán giả (`AUDIENCE`)** cần đăng ký, đăng nhập, xem các concert đã công bố, thông tin nghệ sĩ, sơ đồ khu vực và số vé còn lại; chọn số lượng trong giới hạn, tạo đơn, thanh toán bằng VNPAY hoặc MoMo, xem lịch sử đơn và e-ticket có QR.
- **Ban tổ chức (`ORGANIZER`)** cần tạo, sửa, hủy concert của mình; tải banner; quản lý loại vé, giá, sức chứa, thời gian bán và giới hạn mỗi tài khoản; xem doanh thu; phân công nhân viên check-in; theo dõi nhập khách VIP; tải press kit PDF, xem, sửa hoặc tạo lại tiểu sử nghệ sĩ.
- **Nhân viên check-in (`CHECKIN_STAFF`)** cần đăng nhập trên Android, chỉ thấy sự kiện được phân công, tải snapshot vé và khách VIP theo cổng, quét QR khi có hoặc không có mạng, xem hàng đợi đồng bộ và nhận kết quả xung đột từ backend.

## Phạm vi

### Trong phạm vi

- Một web app React dùng chung cho khán giả và ban tổ chức, một backend API NestJS và một ứng dụng Android dành cho check-in.
- Quản lý vòng đời concert, banner, loại vé theo khu vực, giá, tổng số lượng, thời gian bán, giới hạn mua trên mỗi người dùng và thống kê doanh thu.
- Tạo đơn giữ chỗ trong 15 phút, tự động hết hạn đơn chưa thanh toán, nhả số lượng đã giữ và hiển thị lịch sử đơn hàng.
- Khởi tạo thanh toán VNPAY/MoMo, tiếp nhận kết quả xác nhận, ghi nhận giao dịch thành công, chuyển đơn sang `PAID`, chuyển tồn kho từ giữ chỗ sang đã bán và phát hành vé.
- E-ticket với QR ký HMAC; check-in vé thường và khách VIP theo assignment, kể cả lưu quét ngoại tuyến và đồng bộ lại từ thiết bị Android.
- Cache danh sách concert, chi tiết concert và tình trạng loại vé; rate limiting cho đăng ký, đăng nhập, tạo đơn, thao tác quản trị và API check-in.
- Email xác nhận mua vé và nhắc concert trước khoảng 24 giờ qua SMTP; các adapter push, SMS và Zalo hiện xử lý trong nội bộ tiến trình mà không kết nối dịch vụ bên ngoài.
- Tải PDF lên MinIO, trích xuất văn bản, tạo tiểu sử bằng Gemini theo cấu hình Docker và lưu trạng thái xử lý; hỗ trợ chế độ `openai` hoặc `mock` qua cấu hình backend.
- Quét định kỳ thư mục CSV của nhà tài trợ, kiểm tra cấu trúc và từng dòng, nhận diện file bằng SHA-256, cập nhật snapshot khách VIP, lưu lỗi và audit log.
- Môi trường chạy cục bộ bằng Docker Compose với PostgreSQL, Redis, Kafka và MinIO.

### Ngoài phạm vi

- Triển khai lên môi trường cloud production, cung cấp hạ tầng production và sử dụng các dịch vụ cloud được quản lý.
- Thanh toán thật có luồng tiền thực tế; luồng thanh toán chỉ giới hạn ở môi trường sandbox hoặc cổng thanh toán mô phỏng.
- Xác minh danh tính toàn diện để chống đầu cơ vé trên nhiều tài khoản, thiết bị, phương thức thanh toán hoặc giấy tờ định danh quốc gia.
- Tích hợp API, webhook hoặc cơ sở dữ liệu trực tiếp với hệ thống danh sách khách mời của nhà tài trợ; TicketBox chỉ hỗ trợ nhập CSV theo lịch trong phạm vi đồ án môn học.
- Chọn ghế thời gian thực hoặc đặt vé ở mức từng ghế riêng lẻ ngoài mô hình vé theo khu vực được yêu cầu.

## Rủi ro và ràng buộc

- PostgreSQL là điểm nhất quán trung tâm; sự cố cơ sở dữ liệu ảnh hưởng đến hầu hết luồng nghiệp vụ. Redis hỏng làm cache miss và rate limiter chuyển sang cho phép request, nên tải sẽ dồn về backend và PostgreSQL.
- Cập nhật tồn kho có điều kiện ngăn tổng số lượng giữ/bán vượt sức chứa, nhưng phép cộng quota theo người dùng được kiểm tra trước khi giữ chỗ và không khóa các order cạnh tranh; các request đồng thời của cùng người dùng có nguy cơ vượt `perUserLimit`.
- Luồng payment hiện xác nhận thành công từ redirect/webhook rồi phát hành vé. Controller chưa gọi hàm kiểm tra chữ ký của adapter, payment initiation chưa được lưu, và idempotency của bước xác nhận chủ yếu dựa vào trạng thái `PAID` cùng unique constraint giao dịch; callback cạnh tranh vẫn là rủi ro nhất quán cần được nhìn nhận khi đánh giá hệ thống.
- MoMo thực hiện HTTP call nhưng không đặt timeout hay retry ở adapter; VNPAY được tạo URL cục bộ. Circuit breaker nằm trong memory từng backend instance nên trạng thái không được chia sẻ giữa các replica.
- Số vé còn lại trên web trễ tối đa theo TTL cache ngắn. Quyết định giữ chỗ cuối cùng luôn dựa trên cập nhật có điều kiện ở PostgreSQL, không dựa trên số hiển thị trong Redis.
- Hai thiết bị offline có nguy cơ cùng chấp nhận một QR tại chỗ. Backend giải quyết khi đồng bộ theo lượt ghi thành công đầu tiên; unique index chỉ cho phép một check-in `SUCCESS`, các lượt sau trở thành `CONFLICT` hoặc `ALREADY_USED`.
- Kafka hoặc AI worker lỗi không chặn duyệt concert và mua vé nhưng làm tài liệu tiểu sử ở trạng thái chờ/lỗi. MinIO lỗi ảnh hưởng tải banner và press kit.
- Worker VIP đọc file từ filesystem dùng chung. File sai encoding, delimiter, schema, quá 10 MB, quá 10.000 dòng hoặc thay đổi sau khi xếp hàng bị từ chối; lỗi từng dòng được lưu để ban tổ chức tra cứu.
- Notification được gửi tuần tự sau khi hoàn tất giao dịch; lỗi gửi được ghi log và không hoàn tác order hoặc vé. Bảng `notifications` tồn tại trong schema nhưng luồng gửi hiện tại không ghi hoặc cung cấp hộp thư in-app từ bảng này.
- Web kết xuất ảnh QR qua `api.qrserver.com`, vì vậy signed QR token được gửi tới dịch vụ ngoài thay vì được render hoàn toàn trong TicketBox.
