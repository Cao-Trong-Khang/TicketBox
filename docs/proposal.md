## Vấn đề

Hoạt động bán vé concert quy mô lớn tại Việt Nam hiện đang bị phân mảnh qua nhiều kênh như Zalo OA, Google Forms, chuyển khoản ngân hàng thủ công và các bảng tính xử lý tạm thời. Điều này dẫn đến hàng đợi không công bằng, lạm dụng bot, sập website, rủi ro gian lận, vé bị trùng hoặc bị thiếu, trạng thái thanh toán không chắc chắn và nhiều khoảng trống vận hành tại khâu check-in ở địa điểm tổ chức.

TicketBox cần một nền tảng bán vé thống nhất, có khả năng xử lý tải cao, hỗ trợ toàn bộ vòng đời sự kiện từ đăng tải concert, mua vé, xác nhận thanh toán, gửi vé điện tử, quản trị dành cho ban tổ chức, nhập danh sách khách mời, gửi thông báo, đến check-in sự kiện có khả năng hoạt động ngoại tuyến.

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

- Người dùng khán giả cần duyệt các concert sắp diễn ra, xem chi tiết nghệ sĩ và địa điểm, xem sơ đồ ghế SVG tương tác theo khu vực vé, xem số lượng vé còn lại đủ mới, mua vé một cách công bằng trong giới hạn do ban tổ chức cấu hình, thanh toán qua các cổng thanh toán được hỗ trợ, nhận vé điện tử có mã QR kèm xác nhận qua thông báo trong ứng dụng và email, nhận nhắc nhở concert và check-in tại cổng sự kiện.

- Người dùng ban tổ chức cần quyền truy cập quản trị được kiểm soát để tạo và quản lý concert, cấu hình loại vé, giá vé, sức chứa, thời gian mở bán và giới hạn mua vé theo người dùng, tải lên PDF nghệ sĩ hoặc press kit để tạo tiểu sử bằng AI, cập nhật hoặc hủy concert, theo dõi thống kê bán vé và doanh thu, đồng thời quản lý dữ liệu vận hành như nhập danh sách khách mời VIP theo lịch.

- Nhân viên check-in cần quyền truy cập di động để quét mã QR vé, xác thực nhanh vé thường và khách mời VIP, tiếp tục check-in khi mạng yếu hoặc mất kết nối, và đồng bộ hoạt động tại cổng khi kết nối trở lại.

## Phạm vi

### Trong phạm vi

- Xây dựng nguyên mẫu TicketBox chạy cục bộ bằng Docker Compose.
- Cung cấp chức năng khám phá concert công khai, trang chi tiết concert, thông tin nghệ sĩ và địa điểm, sơ đồ khu vực SVG tương tác theo khu vực vé và hiển thị tình trạng vé còn lại đủ mới.
- Cung cấp luồng mua vé cho khán giả, bao gồm chọn vé, xử lý thanh toán, xác nhận thanh toán thành công, tạo vé điện tử có mã QR và gửi thông báo mua vé.
- Cung cấp trang quản trị cho ban tổ chức để tạo và quản lý concert, cấu hình loại vé, giá vé, sức chứa, thời gian mở bán và giới hạn mua vé theo người dùng, cập nhật hoặc hủy concert, tải lên PDF nghệ sĩ hoặc press kit, và xem thống kê doanh số hoặc doanh thu.
- Cung cấp xác thực và kiểm soát truy cập theo vai trò cho người dùng khán giả, ban tổ chức và nhân viên check-in.
- Cung cấp các cơ chế bảo vệ lưu lượng, xử lý mua vé công bằng, gán vé an toàn trong môi trường đồng thời và áp dụng giới hạn mua vé theo người dùng.
- Cung cấp hành vi tích hợp thanh toán cho VNPAY và MoMo, bao gồm callback thanh toán, timeout, retry và chế độ suy giảm khi cổng thanh toán không khả dụng.
- Cung cấp quy trình thông báo qua thông báo trong ứng dụng và email, đồng thời cho phép bổ sung các kênh thông báo trong tương lai như Zalo OA hoặc SMS mà không thay đổi luồng mua vé cốt lõi.
- Cung cấp quy trình check-in trên di động để quét mã QR vé, xác thực khách mời VIP, ghi nhận lượt quét khi mạng yếu hoặc không khả dụng, và đồng bộ hoạt động tại cổng khi kết nối trở lại.
- Cung cấp xử lý bất đồng bộ PDF nghệ sĩ hoặc press kit để tạo tiểu sử nghệ sĩ bằng AI, bao gồm trạng thái xử lý và xử lý lỗi.
- Cung cấp nhập danh sách khách mời VIP từ file CSV của nhà tài trợ theo lịch, có xác thực dữ liệu, loại bỏ trùng lặp, xử lý dòng lỗi, báo cáo lỗi và không làm gián đoạn hoạt động bán vé hoặc check-in trực tiếp.

### Ngoài phạm vi

- Triển khai lên môi trường cloud production, cung cấp hạ tầng production và sử dụng các dịch vụ cloud được quản lý.
- Thanh toán thật có luồng tiền thực tế; luồng thanh toán chỉ giới hạn ở môi trường sandbox hoặc cổng thanh toán mô phỏng.
- Xác minh danh tính toàn diện để chống đầu cơ vé trên nhiều tài khoản, thiết bị, phương thức thanh toán hoặc giấy tờ định danh quốc gia.
- Tích hợp API, webhook hoặc cơ sở dữ liệu trực tiếp với hệ thống danh sách khách mời của nhà tài trợ; TicketBox chỉ hỗ trợ nhập CSV theo lịch trong phạm vi đồ án môn học.
- Chọn ghế thời gian thực hoặc đặt vé ở mức từng ghế riêng lẻ ngoài mô hình vé theo khu vực được yêu cầu.

## Rủi ro và ràng buộc

- Lưu lượng truy cập tăng đột biến trong thời điểm mở bán vé có thể làm quá tải API backend. Các yêu cầu quá mức cần được giới hạn trước khi đi vào xử lý nghiệp vụ tốn tài nguyên.
- Client có hành vi giống bot và các lần thử mua vé lặp lại có thể làm giảm tính công bằng đối với người dùng hợp lệ. Các API bán vé quan trọng cần có cơ chế bảo vệ lưu lượng và giảm thiểu lạm dụng.
- Cạnh tranh khi mua vé có thể gây bán vượt số lượng hoặc gán trùng vé cuối cùng. Việc giảm tồn kho và gán vé phải được xử lý bằng các cơ chế nhất quán an toàn trong môi trường đồng thời.
- Giới hạn mua vé theo người dùng có thể bị vượt qua trong các yêu cầu đồng thời. Việc kiểm tra hạn mức phải có tính nguyên tử và được đối soát với dữ liệu đơn hàng đã thanh toán chính thức.
- Trạng thái đơn hàng, thanh toán và vé có thể trở nên không nhất quán. Các chuyển đổi trạng thái phải rõ ràng, có tính idempotent, an toàn khi retry và có khả năng khôi phục.
- Cổng thanh toán có thể lỗi, timeout hoặc không khả dụng trong thời gian dài. Xử lý thanh toán phải được cô lập để người dùng vẫn có thể duyệt concert và xem thông tin vé khi nhà cung cấp thanh toán bị suy giảm.
- Các trang công khai có lưu lượng đọc lớn có thể làm quá tải cơ sở dữ liệu. Dữ liệu concert được truy cập thường xuyên cần được cache, và độ mới của thông tin vé còn lại phải được quản lý cẩn thận.
- Chức năng quản trị và check-in liên quan đến các thao tác nhạy cảm. Kiểm soát truy cập phải ngăn chặn việc thay đổi concert, xác thực vé và truy cập doanh thu trái phép.
- Check-in ngoại tuyến có thể làm mất bản ghi quét hoặc cho phép check-in trùng. Quy trình check-in di động phải hỗ trợ xác thực cục bộ, lưu trữ ngoại tuyến bền vững, đồng bộ và xử lý xung đột.
- Tích hợp danh sách khách mời VIP của nhà tài trợ bị giới hạn ở file CSV theo lịch. TicketBox không thể phụ thuộc vào xác thực API thời gian thực từ hệ thống của nhà tài trợ.
- File CSV danh sách khách mời có thể chứa dòng sai định dạng, dữ liệu trùng lặp hoặc thay đổi muộn. Quy trình nhập phải có xác thực dữ liệu, loại bỏ trùng lặp, báo cáo lỗi và không làm gián đoạn hoạt động bán vé hoặc check-in trực tiếp.
- Việc gửi thông báo có thể thất bại hoặc bị chậm. Việc phát hành vé và quyền truy cập vé không được phụ thuộc hoàn toàn vào việc gửi thông báo trong ứng dụng hoặc email thành công.
- Tiểu sử nghệ sĩ do AI tạo phụ thuộc vào chất lượng trích xuất văn bản từ PDF và khả năng sẵn sàng của mô hình AI. Quy trình này phải hiển thị trạng thái xử lý và có hành vi dự phòng khi trích xuất hoặc tạo nội dung thất bại.
