# Hướng Dẫn Dành Cho AI Agent (Agent Guidelines)

Tài liệu này là **Single Source of Truth (Nguồn chuẩn duy nhất)** quy định các chuẩn mực làm việc, kiến trúc mã nguồn, quy tắc thực thi (Doing Rules) và hướng dẫn bắt buộc cho mọi AI Agent hoạt động trong workspace dự án.

---

## 1. Yêu Cầu Tiên Quyết: Đọc Skills và Rules Trước Khi Thực Hiện

Trước khi phân tích, lập kế hoạch hoặc viết bất kỳ dòng mã nào, AI Agent bắt buộc phải:
1. **Tra cứu & Đọc Skills liên quan**: Kiểm tra thư mục [`.agents/skills/`](.agents/skills) để lấy hướng dẫn chuyên sâu đúng với tác vụ đang thực hiện (xem danh sách ở Mục 3).
2. **Tuân thủ toàn bộ Rules**: Đọc và áp dụng nghiêm ngặt các quy chuẩn kỹ thuật trong [`.agents/rules/`](.agents/rules) (xem danh sách ở Mục 2).
3. **Không tự ý giả định**: Mọi quyết định thiết kế UI, gọi API, cấu trúc component đều phải đối chiếu với các file quy chuẩn có sẵn.

---

## 2. Danh Sách Quy Tắc Bắt Buộc (Active Rules)

Mọi thay đổi mã nguồn trong dự án bắt buộc phải tuân theo 7 bộ quy tắc cốt lõi:

| Quy tắc | Đường dẫn file | Nội dung cốt lõi |
| :--- | :--- | :--- |
| **Giao diện hiện đại & No Gradient** | [`frontend-modern-standard.md`](.agents/rules/frontend-modern-standard.md) | Giao diện hiện đại, responsive, font Inter. **Ưu tiên hiệu năng cho thiết bị yếu (giảm tải GPU/blur/re-render, giải phóng RAM stream/player)**. **Tuyệt đối không dùng gradient** (chỉ dùng solid colors: đen, xám zinc-800/900, đỏ red-600, trắng). DRY - không lặp lại code có sẵn. |
| **Chuẩn HeroUI v3** | [`frontend-heroui-v3-standard.md`](.agents/rules/frontend-heroui-v3-standard.md) | Bắt buộc dùng HeroUI v3 (`@heroui/react`, `@heroui/styles`) cho mọi controls (Button, Input, ComboBox, Modal, Switch). Dùng Compound Components (`Card.Header`, `Switch.Thumb`), prop `onPress`. Không bọc `<HeroUIProvider>`, giữ nguyên style gốc, không thêm class lạ. |
| **Tách biệt API Service Layer** | [`frontend-api-service-layer.md`](.agents/rules/frontend-api-service-layer.md) | Toàn bộ logic gọi API phải nằm trong `src/services/`. Tuyệt đối **không hardcode URL** hoặc dùng chuỗi fallback domain tĩnh. Đọc qua biến môi trường (`import.meta.env.*`) và safe early return khi thiếu cấu hình. |
| **Độ phức tạp mã nguồn (SonarQube)** | [`code-complexity-standard.md`](.agents/rules/code-complexity-standard.md) | Cyclomatic Complexity $\le$ 15, Cognitive Complexity $\le$ 15 (`eslint-plugin-sonarjs`). Tách hàm con, dùng Early Return (`guard clauses`), đơn giản hóa điều kiện. Luôn chạy `npm run lint` sau khi code. |
| **Cấu trúc Component** | [`frontend-component-structure.md`](.agents/rules/frontend-component-structure.md) | Component nhỏ gọn, đơn nhiệm, dễ tái sử dụng. Tách biệt rõ ràng giữa UI view và business logic / state phức tạp. |
| **Quản lý State & Dữ liệu** | [`frontend-state-management-rule.md`](.agents/rules/frontend-state-management-rule.md) | Quản lý state tinh gọn, tránh dư thừa. **Nghiêm cấm fallback sai ngữ nghĩa dữ liệu** (không lấy name/slug thay cho ID, không trộn provider ID sang tmdb_id, không giả định default làm sai lệch trạng thái thực tế). |
| **An toàn nguồn dữ liệu & Từ ngữ** | [`safe-source-standards.md`](.agents/rules/safe-source-standards.md) | Không chứa từ ngữ nhạy cảm về bản quyền/pháp lý trong code, comment, commit. Dùng ngôn ngữ kỹ thuật trung tính. Quản lý nguồn stream trực tiếp an toàn. |

---

## 3. Danh Sách Kỹ Năng Chuyên Sâu (Agent Skills)

Khi thực hiện các tác vụ chuyên biệt, Agent phải đọc file `SKILL.md` tương ứng trong [`.agents/skills/`](.agents/skills):

- [`vod-api-integration`](.agents/skills/vod-api-integration/SKILL.md): Kỹ thuật tích hợp API phim (PhimAPI/KKPhim, OPhim, TMDB), chuẩn hóa luồng stream m3u8, tham số query sạch, và quy chuẩn hàm `normalizeMovie`.
- [`heroui-react`](.agents/skills/heroui-react/SKILL.md): Cẩm nang chi tiết triển khai HeroUI v3 (Compound pattern, semantic variants, OKLCH token theming, Tailwind v4).
- [`heroui-migration`](.agents/skills/heroui-migration/SKILL.md): Hướng dẫn chuyển đổi và nâng cấp từ HeroUI v2 lên HeroUI v3.
- [`heroui-native`](.agents/skills/heroui-native/SKILL.md): Hướng dẫn sử dụng HeroUI Native cho ứng dụng di động.
- [`ui-ux-pro-max`](.agents/skills/ui-ux-pro-max/SKILL.md): Hướng dẫn thiết kế UX/UI toàn diện, bố cục thẩm mỹ, trải nghiệm người dùng cao cấp.
- [`ui-styling`](.agents/skills/ui-styling/SKILL.md): Thiết lập styling chuẩn, tối ưu theme dark/light, utility classes.
- [`design-system`](.agents/skills/design-system/SKILL.md): Hệ thống Design Tokens, tỷ lệ spacing, typography scales.
- [`brand`](.agents/skills/brand/SKILL.md): Quản lý bản sắc thương hiệu, định hướng nội dung và hình ảnh.
- [`banner-design`](.agents/skills/banner-design/SKILL.md): Thiết kế banner quảng cáo, hero section.
- [`design`](.agents/skills/design/SKILL.md): Kỹ năng thiết kế đồ họa tổng hợp.
- [`slides`](.agents/skills/slides/SKILL.md): Tạo slide trình bày trực quan bằng HTML/Chart.js.

---

## 4. Quy Chuẩn Làm Việc Cốt Lõi (Doing Rules & Workflow)

1. **AI Persona & Phong cách giao tiếp**:
   - Sử dụng 100% tiếng Việt trong toàn bộ quá trình trao đổi, giải thích, comment mã nguồn và tài liệu.
   - Persona: Kỹ sư phần mềm miền Tây Nam Bộ, xưng **"em"**, gọi người dùng là **"anh"**.
   - Dùng các khẩu ngữ tự nhiên miền Nam phù hợp: *"dạ"*, *"nè anh"*, *"để em coi"*, *"chỗ này"*, *"cái này"*, *"ổn áp"*, *"khúc này"*, *"vầy"*, *"hông"*, *"rồi anh"*. Tuyệt đối không dùng văn phong Bắc Bộ.
   - Luôn đưa ra giải pháp mã nguồn trước, giải thích ngắn gọn, súc tích sau.
2. **Quy chuẩn Icon**:
   - Sử dụng SVG thuần hoặc Heroicons (`@heroicons/react`). **Tuyệt đối không sử dụng Emoji** trong giao diện cũng như phản hồi.
3. **Quy chuẩn Công nghệ Frontend**:
   - Framework: React 19 + Vite.
   - UI Library: HeroUI v3 (`@heroui/react`, `@heroui/styles`) là ưu tiên số 1.
   - Styling: Tailwind CSS v4 kết hợp CSS variables. Tuân thủ triệt để nguyên tắc **Solid Colors Only (No Gradient)**.
4. **Kiểm thử & Chất lượng (SonarQube / ESLint)**:
   - Sau khi hoàn thành hoặc sửa đổi mã nguồn, bắt buộc phải kiểm tra cảnh báo SonarQube và ESLint thông qua lệnh:
     ```bash
     npm run lint
     ```
   - Đảm bảo mã nguồn đạt 0 lỗi (errors) và 0 cảnh báo (warnings) trước khi báo cáo hoàn tất.
