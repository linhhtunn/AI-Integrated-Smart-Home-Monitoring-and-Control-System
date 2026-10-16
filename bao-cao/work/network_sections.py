"""Project-specific network and service deployment content for the course report."""

def add_network_sections(H,P,F,T):
    H('Thiết kế mạng và phân bố các dịch vụ',2)
    H('Mô hình kết nối trong mạng nội bộ')
    P('Hệ thống sử dụng mạng LAN làm môi trường kết nối giữa nút ESP32 và máy tính chạy các dịch vụ. ESP32 kết nối với điểm truy cập WiFi; máy tính có thể nối với cùng mạng bằng WiFi hoặc Ethernet. Bộ định tuyến cung cấp kết nối IP giữa hai phía. Vì ESP32 chủ động tạo phiên TCP đến broker, việc tiếp nhận dữ liệu không yêu cầu trình duyệt kết nối trực tiếp đến vi điều khiển.',
      'Ở phía máy tính, nhóm tách các vai trò thành broker bản tin, máy chủ ứng dụng, cơ sở dữ liệu, dịch vụ mô hình AI và máy chủ giao diện. Các thành phần này có thể cùng chạy trên một máy nhưng đảm nhiệm những nhiệm vụ khác nhau. Broker phân phối bản tin; backend quyết định cách lưu, truy vấn và chuyển dữ liệu; MySQL giữ lịch sử; Ollama sinh câu trả lời; React trình bày thông tin cho người dùng. Cách tổ chức này giúp xác định rõ một yêu cầu đi qua những dịch vụ nào khi kiểm tra hệ thống.',
      'Trong cấu hình ESPHome do nhóm sử dụng, địa chỉ broker là 192.168.0.102 và cổng là 1883. Đây là địa chỉ của máy chủ nhìn từ ESP32 trong cấu hình triển khai đó. Khi chuyển sang mạng khác, cần kiểm tra lại địa chỉ IPv4 của máy chủ, dải mạng, kết nối WiFi và quy tắc tường lửa. Ảnh khám phá thiết bị ở một phiên khác có thể chứa địa chỉ thuộc dải 192.168.1.x; hai địa chỉ này thuộc những thời điểm cấu hình khác nhau, không được mặc định là cùng một mạng đang hoạt động.')
    F('network-topology.png','Sơ đồ mạng LAN và vị trí các dịch vụ trên máy chủ')
    P('Luồng vận hành chính nằm trong LAN. Sau khi đã cài các gói phần mềm và tải mô hình AI, các bước chuyển trạng thái MQTT, lưu MySQL, truy vấn REST, cập nhật WebSocket và hỏi đáp Ollama đều sử dụng dịch vụ cục bộ. Internet phục vụ việc cài đặt, cập nhật hoặc tải tài nguyên khi cần. Khả năng giám sát vẫn phụ thuộc vào nguồn cấp thiết bị, điểm truy cập và máy chủ hoạt động ổn định.')

    H('Phân biệt địa chỉ thiết bị, máy chủ và loopback')
    P('Địa chỉ localhost được hiểu theo máy đang thực hiện kết nối. Backend dùng mqtt://localhost:1883 vì backend và cổng broker được công bố trên cùng máy tính. ESP32 không thể dùng localhost để tìm máy tính: trên ESP32, tên đó chỉ chính thiết bị. Do vậy, firmware phải sử dụng IP LAN của máy chủ hoặc một tên máy được mạng nội bộ phân giải đúng.',
      'Tương tự, localhost trong mã frontend được trình duyệt diễn giải trên máy của người xem. Với cách trình diễn hiện tại, trình duyệt mở trên chính máy chủ nên các địa chỉ http://localhost:3000 và ws://localhost:8081 hoạt động phù hợp. Nếu mở dashboard trên điện thoại, các địa chỉ này sẽ trỏ về điện thoại. Chỉ thay URL của trang web sang IP máy tính sẽ chưa đủ; địa chỉ API và WebSocket trong ứng dụng cũng phải được cấu hình theo máy chủ thực tế.')
    T('Bảng 3.9 Phân bố dịch vụ, cổng và phía sử dụng',
      ['Dịch vụ','Địa chỉ hoặc cổng','Phía kết nối và vai trò'],[
      ('Mosquitto MQTT','TCP 1883; IP LAN của máy chủ hoặc localhost','ESP32 dùng IP LAN; backend và MQTT Explorer trên máy chủ dùng localhost/127.0.0.1.'),
      ('Backend REST','HTTP 3000','Trình duyệt gọi lịch sử, thói quen, chatbot và gửi yêu cầu điều khiển.'),
      ('Backend WebSocket','WS 8081','Trình duyệt duy trì kết nối để nhận trạng thái và thông báo mới.'),
      ('MySQL','TCP 3306; DB_HOST=localhost','Backend kết nối cơ sở dữ liệu nha_thong_minh; trình duyệt không truy cập MySQL trực tiếp.'),
      ('Ollama','HTTP 127.0.0.1:11434','Backend gọi /api/chat cho nhánh hỏi đáp tự do bằng llama3.1:latest.'),
      ('Vite / React','HTTP localhost:5173','Máy chủ giao diện dùng trong giai đoạn phát triển và trình diễn.'),
      ('ESPHome Device Builder','HTTP localhost:6052','Công cụ soạn cấu hình, biên dịch và quản lý firmware; tách khỏi đường dữ liệu của dashboard.')],
      [3.0,4.1,8.9])
    P('Các cổng ở bảng trên là cổng dịch vụ phía máy chủ; máy khách sử dụng cổng nguồn do hệ điều hành cấp khi mở kết nối. Khi vận hành trong LAN, cần giữ ổn định IP máy chủ, chẳng hạn bằng cách đặt trước địa chỉ DHCP tại router. Các mật khẩu WiFi, OTA, khóa API và thông tin cơ sở dữ liệu được lưu riêng; bảng địa chỉ chỉ mô tả vị trí kết nối, không chứa thông tin xác thực.')

    H('Broker Mosquitto, ánh xạ cổng và lưu bền')
    P('Mosquitto được triển khai trong container có tên mosquitto. Kiểm tra cấu hình cho thấy cổng TCP 1883 của container được công bố thành cổng 1883 trên máy chủ. Đường đi của bản tin từ ESP32 là: IP LAN của máy tính → cổng 1883 được Docker công bố → listener 1883 trong container. Vì vậy, firmware không cần biết địa chỉ IP riêng bên trong container.',
      'Tệp cấu hình trên máy chủ được gắn vào /mosquitto/config/mosquitto.conf. Dữ liệu broker được đặt trong volume mosquitto_data tại /mosquitto/data; log được đặt trong volume mosquitto_log tại /mosquitto/log. Cấu hình persistence true cùng persistence_location cho phép Mosquitto lưu trạng thái bền theo cơ chế của broker. Kho này phục vụ hoạt động MQTT; lịch sử ứng dụng vẫn được lưu riêng trong MySQL.',
      'Cấu hình đang sử dụng gồm listener 1883, allow_anonymous true, persistence true và đích log dạng tệp. Docker công bố cổng trên các địa chỉ host 0.0.0.0 và ::; phạm vi truy cập từ máy khác còn phụ thuộc tường lửa và mạng của máy chủ. Ánh xạ cổng cho phép thiết bị trong LAN tiếp cận broker nhưng không tự tạo phân quyền cho từng topic. Khi triển khai rộng hơn mô hình học tập, nhóm cần bổ sung tài khoản, ACL và kiểm soát phạm vi truy cập [11].')

    H('Tổ chức trao đổi MQTT và ý nghĩa trạng thái phản hồi')
    P('Broker đóng vai trò trung gian giữa bên phát và bên đăng ký nhận. ESP32 công bố các topic kết thúc bằng /state và nhận các topic điều khiển kết thúc bằng /set. Backend đăng ký nha/phongkhach/# để nhận toàn bộ nhánh phòng khách. MQTT Explorer là một client quan sát độc lập, thuận tiện đối chiếu topic và payload mà không phụ thuộc giao diện React.',
      'Trong backend, mỗi bản tin nhận được được chuyển thành chuỗi, ghi vào cam_bien_data rồi mới phát qua WebSocket. Do bộ lọc dùng ký tự #, cả bản tin trạng thái lẫn bản tin lệnh trong nhánh phòng khách đều đi vào bảng. Các API lịch sử lại lọc đúng topic /state của từng loại để hiển thị dữ liệu cảm biến. Sự phân biệt này giúp giải thích vì sao tổng số hàng trong cơ sở dữ liệu lớn hơn số mẫu đo môi trường.',
      'MQTT có ba mức QoS: 0 truyền tối đa một lần; 1 bảo đảm ít nhất một lần và có thể lặp; 2 bảo đảm đúng một lần ở tầng giao thức [10]. Các bản tin retained quan sát khi kiểm tra broker có QoS 0. Dự án chưa cấu hình thêm mã lệnh hoặc cơ chế xác nhận nghiệp vụ để đo tỷ lệ thực thi đầu ra.',
      'Bản tin retained cho phép client mới nhận trạng thái cuối đã lưu trên một topic [10]. Khi backend kết nối lại, giá trị này có thể được ghi thêm với thời điểm nhận mới, dù không phải phép đo mới tại cảm biến. Trong dữ liệu kiểm tra đã gặp 8 trạng thái retained. Do payload hiện không chứa thời điểm đo gốc, cần phân biệt thời gian nhận tại backend với thời gian thiết bị thực sự lấy mẫu.',
      'Ví dụ, POST /api/relay với trang_thai=ON làm backend công bố nha/phongkhach/relay/set. Phản hồi HTTP cho biết yêu cầu đã được xử lý đến bước gửi lệnh. Tiếp đó, ESP32 nhận lệnh, tác động GPIO26 và công bố relay/state. Dashboard chỉ đổi trạng thái hiển thị khi nhận phản hồi trạng thái. Đây là phản hồi logic của firmware; muốn xác nhận tải điện thực sự hoạt động cần thêm tín hiệu đo hoặc quan sát phần cứng. Các lệnh /set hiện được backend gửi mà không đặt retain=true, tránh việc dùng trạng thái lệnh lưu bền như một cơ chế tự chạy lại khi thiết bị kết nối sau.')
    F('network-sequence.png','Hai luồng trao đổi trạng thái cảm biến và lệnh điều khiển')

    H('REST, WebSocket và ranh giới giữa các dịch vụ')
    P('REST phục vụ những thao tác có yêu cầu và phản hồi rõ ràng: lấy 50 hàng lịch sử, đọc hoặc sửa thói quen, gửi yêu cầu bật tắt và hỏi chatbot. WebSocket phục vụ các sự kiện phát sinh sau khi trang đã mở. Nhờ kết hợp hai cơ chế, người dùng thấy dữ liệu đã lưu ngay khi tải trang và tiếp tục nhận thay đổi mà không phải liên tục làm mới trang.',
      'Thông điệp cảm biến trên WebSocket có dạng {"topic":"nha/phongkhach/nhietdo/state","gia_tri":"29.9"}. Frontend ánh xạ topic sang thẻ tương ứng và cập nhật biểu đồ với các đại lượng nhiệt độ, độ ẩm. Thông điệp gợi ý có dạng {"type":"canh_bao","message":"...","muc":"goi_y"}; frontend dùng type và muc để chọn khu vực và màu hiển thị. Một kết nối WebSocket có thể chuyển nhiều loại sự kiện mà không cần mở kết nối riêng cho từng cảm biến.',
      'Frontend và API dùng hai cổng khác nhau nên thuộc hai origin khác nhau. Backend bật middleware cors() để cho phép trình duyệt gọi API. CORS chỉ điều khiển quyền đọc phản hồi trong trình duyệt, không thay thế xác thực người dùng. Nhãn Đã kết nối trên dashboard được đặt khi WebSocket mở; nhãn này không đồng thời chứng minh ESP32 đang trực tuyến, MySQL ghi thành công hoặc Ollama đã sẵn sàng. Mỗi dịch vụ cần được kiểm tra theo đúng vai trò của nó.',
      'Tại thời điểm kiểm tra, Vite lắng nghe trên 127.0.0.1:5173 và Ollama trên 127.0.0.1:11434. Đây là phạm vi truy cập cục bộ. Vite có tùy chọn host cho nhu cầu thử từ thiết bị trong LAN [12]; khi áp dụng còn phải cấu hình lại địa chỉ API, WebSocket và tường lửa. Phiên bản trình diễn dùng HTTP/WS; triển khai lâu dài có thể đặt frontend và API sau một reverse proxy với HTTPS/WSS và cơ chế đăng nhập.')

    H('Dịch vụ AI và các thành phần quản trị thiết bị')
    P('Ollama là một dịch vụ HTTP riêng, không phải thư viện nhúng trong tiến trình Node.js. Với câu hỏi thông thường, backend truy vấn MySQL, tạo ngữ cảnh gồm nhiệt độ, độ ẩm, gợi ý, bất thường và thói quen rồi gọi http://localhost:11434/api/chat. Yêu cầu chỉ rõ model llama3.1:latest và stream=false; vì vậy backend chờ một kết quả hoàn chỉnh trước khi trả tra_loi cho trình duyệt. Lần gọi đầu có thể bao gồm thời gian nạp mô hình vào bộ nhớ, cần tách khỏi thời gian suy luận khi đánh giá hiệu năng.',
      'Nếu Ollama dừng, các chức năng MQTT, truy vấn lịch sử và relay vẫn có đường xử lý riêng trong backend. Nhánh nhận diện lệnh đèn hoặc còi bằng regex cũng không gọi Ollama. Ngược lại, nhánh hỏi đáp dữ liệu phụ thuộc cả MySQL lẫn dịch vụ mô hình. Đây là cơ sở để xác định nguyên nhân khi một trang vẫn hiển thị cảm biến nhưng câu hỏi AI không trả lời.',
      'ESPHome Device Builder phục vụ quá trình xây dựng firmware. Native API có khóa mã hóa và OTA có mật khẩu trong cấu hình thiết bị, song đường giám sát của dự án sử dụng MQTT. Lỗi của một phiên Native API cần được kiểm tra riêng, không thể chỉ từ thông báo đó kết luận kết nối MQTT đã mất. Các tính năng quản trị hỗ trợ việc cấu hình, nạp và theo dõi thiết bị; chúng không thay thế broker, API hoặc cơ sở dữ liệu ứng dụng.')

    H('Vận hành dịch vụ và kiểm tra khi kết nối gián đoạn',2)
    P('Quy trình khởi động được sắp xếp theo quan hệ phụ thuộc. Đặc biệt, MySQL cần sẵn sàng trước khi backend nhận dữ liệu MQTT vì mã hiện tại chờ ghi cơ sở dữ liệu rồi mới broadcast. Broker có thể chuyển các trạng thái retained ngay sau khi backend đăng ký, nên việc chuẩn bị cơ sở dữ liệu từ đầu giúp hạn chế lỗi ở thời điểm kết nối. Ollama cần sẵn sàng trước khi thử nhánh hỏi đáp AI.')
    T('Bảng 3.10 Trình tự khởi động và dấu hiệu sẵn sàng',
      ['Bước','Thành phần','Dấu hiệu kiểm tra'],[
      ('1','Mạng LAN và nguồn mô hình','Máy chủ có IP phù hợp; ESP32 có WiFi và được cấp nguồn ổn định.'),
      ('2','MySQL80','Dịch vụ chạy; mở được nha_thong_minh và đọc được hai bảng dữ liệu.'),
      ('3','Docker và Mosquitto','Container mosquitto chạy; có ánh xạ 1883; MQTT Explorer kết nối được.'),
      ('4','Ollama','/api/tags có llama3.1:latest; nhánh /api/chat có thể phản hồi.'),
      ('5','Backend Node.js','REST cổng 3000 và WebSocket 8081 lắng nghe; log cho thấy đã kết nối broker.'),
      ('6','Frontend Vite','Mở localhost:5173; tải được lịch sử và có kết nối WebSocket.'),
      ('7','Đối chiếu toàn tuyến','Quan sát một /state trong MQTT Explorer, hàng dữ liệu tương ứng và thẻ trên dashboard.')],
      [1.1,4.0,10.9])
    P('Mỗi dấu hiệu trả lời một câu hỏi khác nhau: cổng lắng nghe cho biết có tiến trình nhận kết nối; MQTT Explorer cho biết broker nhận và phân phối bản tin; truy vấn MySQL cho biết dữ liệu đã được lưu; dashboard cho biết ứng dụng đã diễn giải và trình bày được giá trị. Kiểm tra đủ chuỗi sẽ có ý nghĩa hơn việc chỉ quan sát nhãn kết nối ở một màn hình.')
    T('Bảng 3.11 Khoanh vùng lỗi mạng và dịch vụ',
      ['Hiện tượng','Phạm vi cần kiểm tra','Cách đối chiếu'],[
      ('Không thấy topic từ ESP32','WiFi, IP broker, cổng 1883, tường lửa','Kiểm tra ESP32 cùng LAN; so IP trong YAML với IP máy chủ; dùng MQTT Explorer theo dõi đúng nhánh.'),
      ('Broker có dữ liệu, web không đổi','Backend, MySQL hoặc WebSocket','Xem log MQTT của backend; tìm hàng mới trong cam_bien_data; kiểm tra phiên WS 8081.'),
      ('Web có số liệu nhưng không có bản tin mới','Dữ liệu REST cũ hoặc retained','Đối chiếu thời điểm từng mẫu với hoạt động thiết bị; nhãn kết nối WS chưa thể hiện độ mới của cảm biến.'),
      ('Gửi relay nhận 200 nhưng trạng thái chưa đổi','Đường lệnh hoặc thiết bị chấp hành','Quan sát relay/set rồi relay/state; kiểm tra chế độ vận hành, nguồn và GPIO trên mô hình.'),
      ('API lịch sử lỗi, broker vẫn chạy','MySQL và xử lý truy vấn','Kiểm tra MySQL80, cấu hình DB_HOST/DB_NAME, quyền kết nối và tên bảng.'),
      ('Chỉ hỏi đáp AI bị lỗi','Ollama, mô hình hoặc ngữ cảnh MySQL','Kiểm tra 11434, /api/tags, bộ nhớ máy và log backend; phân biệt nhánh regex với nhánh LLM.'),
      ('Máy chủ mở được, điện thoại không mở được','Phạm vi lắng nghe và địa chỉ frontend','Kiểm tra host của Vite, IP đích API/WS, cùng LAN và tường lửa; localhost trên điện thoại chỉ điện thoại.')],
      [3.7,4.2,8.1])
    P('Khi WebSocket đóng, frontend tự tạo lại kết nối sau 3 giây. MQTT.js có cơ chế kết nối lại và backend đăng ký nhánh phòng khách trong sự kiện connect. Tuy nhiên, phiên bản hiện tại chưa có hàng đợi lưu ngoại tuyến, mã bản tin để khử lặp, hay bước đồng bộ lại toàn bộ lịch sử sau mỗi lần WebSocket nối lại. Do đó, kết nối phục hồi không đồng nghĩa với việc mọi sự kiện trong thời gian mất mạng đều đã được bổ sung.',
      'Từ thiết kế hiện tại, hướng hoàn thiện phù hợp là thêm thời điểm đo và mã bản tin ở thiết bị, chỉ mục topic–thời gian cho dữ liệu lịch sử, kiểm tra sức khỏe từng dịch vụ, xử lý lỗi ghi cơ sở dữ liệu và trạng thái thiết bị trực tuyến. Đối với mạng, cần giới hạn các cổng được phép truy cập, bổ sung xác thực broker và API, rồi mới mở rộng đến truy cập ngoài LAN. Những thay đổi này giữ nguyên luồng chức năng của đề tài nhưng giúp vận hành và chẩn đoán rõ ràng hơn.')
