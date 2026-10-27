# robo-fruit

Mô phỏng robot 3D tương tác theo tỷ lệ tham chiếu Tonybot (sử dụng Three.js).

## Tính năng
- **3 biến thể mô hình 3D**:
  - Bản gốc Tonybot (`robot-animated.glb`)
  - Robot Trợ lý (`robot-assistant.glb`)
  - Robot Mecha (`robot-mecha.glb`)
- **Animation chuyển động**: Đứng (idle), Đi bộ (walk), Chạy (run), Nhảy (jump), Vẫy tay (wave), Nhún nhảy (dance), Nói chuyện (talk).
- **Tương tác & Điều khiển**:
  - Xoay 360°, phóng to/thu nhỏ (OrbitControls).
  - Điều chỉnh từng góc khớp servo (LX-824HV).
  - Đổi màu sắc / ngoại hình (Skin), mở/đóng giáp mecha, thay đổi biểu cảm.
  - **Áo BDU**: áo polo đỏ bằng vải piqué mềm (cổ áo, nẹp cúc, tay áo ngắn, logo BDU thêu ở ngực trái), mặc thẳng lên robot và đi theo mọi chuyển động. Logo hiện vẽ bằng canvas trong `model.mjs` (`bduLogoTexture`), có thể thay bằng ảnh logo chính thức.
- **Xuất file**: Hỗ trợ xuất và tải trực tiếp mô hình `.glb`.

## Phòng học Robot Bolt (`bolt-robot.html`)
Trang tương tác riêng cho trẻ em của Viện Ngoại ngữ Bolt, dùng màu, font và thành phần copy từ website `ngoaingubolt.bdu.edu.vn`.
- Phòng học 3D dựng bằng Three.js (`classroom.mjs`): bảng trắng hiển thị lời robot nói và lời bài hát, thảm cầu vồng, kệ sách, cờ chữ cái, bàn ghế, cửa sổ.
- 6 nút hành động cỡ lớn, ô chat (`bolt-chat.mjs`, luật từ khóa chạy trong trình duyệt, không gửi dữ liệu đi), hát 3 bài thiếu nhi thuộc phạm vi công cộng (`bolt-songs.mjs`, Web Audio), đổi trang phục.
- Icon: [Phosphor Icons](https://phosphoricons.com/) duotone, giấy phép MIT (`vendor/PHOSPHOR-LICENSE`).
- Logo và font thương hiệu dùng đường dẫn của web Bolt (`/bolt/logo.jpg`, `/bolt/fonts/vni-redrock.woff2`); khi chạy ở máy khác sẽ hiện chữ "Bolt" thay thế.

## Cài đặt & Khởi chạy
Dự án sử dụng Web Standards thuần (HTML5, Vanilla JS ES Modules, Three.js), không cần build:

```bash
# Cách 1: Sử dụng Python
python -m http.server 3000

# Cách 2: Sử dụng Node.js serve
npx serve .
```
Mở trình duyệt tại `http://localhost:3000` để sử dụng, hoặc `http://localhost:3000/bolt-robot.html` cho Phòng học Robot Bolt.
