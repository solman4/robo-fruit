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

## Cài đặt & Khởi chạy
Dự án sử dụng Web Standards thuần (HTML5, Vanilla JS ES Modules, Three.js), không cần build:

```bash
# Cách 1: Sử dụng Python
python -m http.server 3000

# Cách 2: Sử dụng Node.js serve
npx serve .
```
Mở trình duyệt tại `http://localhost:3000` để sử dụng.
