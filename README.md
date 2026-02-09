# Entertainment - Dự án học tập React

> **Disclaimer:** Đây là dự án mã nguồn mở phục vụ mục đích **học tập và nghiên cứu**. Dự án không lưu trữ, phân phối hay sở hữu bất kỳ nội dung video nào. Tất cả nội dung đều được lấy từ các API công khai của bên thứ ba. Tác giả không chịu trách nhiệm về việc sử dụng sai mục đích của người dùng.

## Mục đích dự án

Dự án này được xây dựng nhằm **học tập và thực hành** các kỹ thuật lập trình web hiện đại:

-   Xây dựng ứng dụng React từ đầu với Vite
-   Thực hành Tailwind CSS và responsive design
-   Tích hợp video player (HLS streaming)
-   Xử lý authentication với Firebase
-   Quản lý state với React Hooks và Context API
-   Internationalization (i18n) với i18next
-   Làm việc với REST APIs

## Kỹ thuật được áp dụng

### Frontend Architecture

-   **Component-based design:** Tái sử dụng components, tách biệt logic và UI
-   **Custom Hooks:** `useLocalStorage`, `useQuery` để quản lý state
-   **React Context:** Authentication context cho user session
-   **Lazy loading:** Tối ưu performance với dynamic imports

### Video Streaming

-   **HLS.js integration:** Xử lý adaptive bitrate streaming
-   **JWPlayer customization:** Thêm custom controls, keyboard shortcuts
-   **Cross-browser support:** Fallback strategies cho các trình duyệt khác nhau

### State Management

-   **Local Storage persistence:** Lưu preferences, watch history
-   **Firebase Firestore sync:** Real-time database cho cross-device sync
-   **Optimistic UI updates:** Cập nhật UI ngay lập tức, sync background

### UX/UI Features

-   **Responsive design:** Mobile-first với Tailwind breakpoints
-   **Dark mode:** Zinc color palette cho mắt thoải mái
-   **Keyboard shortcuts:** Accessibility và power user support
-   **Skeleton loading:** Smooth loading experience

## Tính năng demo

-   Giao diện danh sách phim với pagination
-   Trang chi tiết phim với metadata từ TMDb
-   Video player với các controls cơ bản
-   Lưu tiến độ xem vào localStorage
-   Tự động chuyển tập, bỏ qua intro
-   Chế độ Theater Mode
-   Đa ngôn ngữ (VI/EN)
-   Dark mode

## Công nghệ sử dụng

-   **Frontend:** React 18, Vite 5
-   **Styling:** Tailwind CSS 4
-   **Routing:** React Router DOM 6
-   **State Management:** React Hooks, Context API
-   **Backend/Auth:** Firebase (Firestore, Authentication)
-   **i18n:** i18next
-   **Video Player:** JWPlayer (desktop), HLS.js (mobile)

## Cài đặt

### Yêu cầu

-   Node.js >= 18
-   npm hoặc yarn

### Bước 1: Clone repository

```bash
git clone <repository-url>
cd entertainment
```

### Bước 2: Cài đặt dependencies

```bash
npm install
```

### Bước 3: Cấu hình môi trường

Tạo file `.env` với các biến môi trường:

```env
VITE_SOURCE_K_API=<api-url>
VITE_SOURCE_K_CDN_IMAGE=<cdn-url>
VITE_SOURCE_C_API=<api-url>
VITE_SOURCE_O_API=<api-url>
VITE_SOURCE_O_FRONTEND=<frontend-url>
VITE_SOURCE_O_CDN_IMAGE=<cdn-url>
VITE_TMDB_API_KEY=<tmdb-api-key>
VITE_TMDB_BASE_URL=https://api.themoviedb.org/3

# Firebase config
VITE_FIREBASE_API_KEY=<firebase-api-key>
VITE_FIREBASE_AUTH_DOMAIN=<firebase-auth-domain>
VITE_FIREBASE_PROJECT_ID=<firebase-project-id>
VITE_FIREBASE_STORAGE_BUCKET=<firebase-storage-bucket>
VITE_FIREBASE_MESSAGING_SENDER_ID=<firebase-messaging-sender-id>
VITE_FIREBASE_APP_ID=<firebase-app-id>
```

### Bước 4: Chạy ứng dụng

```bash
# Development
npm run dev

# Build production
npm run build

# Preview production build
npm run preview
```

## Cấu trúc thư mục

```
entertainment/
├── public/             # Static files
├── src/
│   ├── components/     # React components
│   ├── contexts/       # React Context (Auth, etc.)
│   ├── i18n/           # Đa ngôn ngữ
│   │   └── locales/    # File ngôn ngữ (en.json, vi.json)
│   ├── pages/          # Các trang chính
│   │   ├── Home.jsx
│   │   ├── TV.jsx
│   │   ├── VodPlay.jsx
│   │   └── Vods.jsx
│   ├── services/       # Firebase services
│   ├── styles/         # CSS files
│   ├── App.jsx
│   └── main.jsx
├── css/
│   └── tailwind.css
├── package.json
├── tailwind.config.js
├── vite.config.js
└── README.md
```

## Phím tắt (VodPlay)

| Phím               | Chức năng        |
| ------------------ | ---------------- |
| `Space` / `K`      | Play/Pause       |
| `J` / `ArrowLeft`  | Tua lùi 10 giây  |
| `L` / `ArrowRight` | Tua tiến 10 giây |
| `F`                | Fullscreen       |
| `M`                | Mute/Unmute      |
| `T`                | Chế độ nhà hát   |
| `N`                | Tập tiếp theo    |

## Học được gì từ dự án này

1. **React Ecosystem:** Hiểu sâu về React hooks, context, và component lifecycle
2. **Modern CSS:** Thành thạo Tailwind CSS, responsive design patterns
3. **Video Streaming:** Kiến thức về HLS protocol, adaptive streaming
4. **Firebase:** Authentication, Firestore real-time database
5. **API Integration:** Fetch, error handling, data normalization
6. **Performance:** Lazy loading, memoization, debounce/throttle
7. **UX Patterns:** Skeleton loading, optimistic updates, keyboard accessibility

## Lưu ý quan trọng

-   Dự án này **KHÔNG** lưu trữ bất kỳ video hay nội dung có bản quyền nào
-   Tất cả video được stream trực tiếp từ các nguồn API công khai
-   Mục đích duy nhất là học tập các kỹ thuật lập trình web
-   Không sử dụng cho mục đích thương mại

## Tác giả

**tchiphuong** - Dự án cá nhân phục vụ học tập

## License

ISC

---

_Dự án này được tạo ra với mục đích giáo dục. Vui lòng tôn trọng bản quyền nội dung._
