import { LockClosedIcon } from "@heroicons/react/24/outline";
import { Button } from "../ui";

/**
 * Component hiển thị thông báo yêu cầu đăng nhập tài khoản bằng Google
 */
export const AuthPrompt = ({
    title = "Yêu cầu đăng nhập",
    description = "Vui lòng đăng nhập để tiếp tục sử dụng tính năng này.",
    buttonLabel = "Đăng nhập với Google",
    onLogin,
    isLoading = false,
    className = "",
}) => {
    return (
        <div className={`mt-6 flex flex-col items-center rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 text-center ${className}`}>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-800 text-amber-400">
                <LockClosedIcon className="h-6 w-6 stroke-2" />
            </div>
            <h3 className="mt-4 text-sm font-bold text-white">
                {title}
            </h3>
            <p className="mt-1.5 max-w-sm text-xs text-zinc-400 leading-relaxed">
                {description}
            </p>
            <Button
                type="button"
                onPress={onLogin}
                variant="primary"
                size="md"
                disabled={isLoading}
                className="mt-5 w-full max-w-xs"
            >
                <svg
                    className="h-4 w-4 shrink-0"
                    aria-hidden="true"
                    viewBox="0 0 488 512"
                >
                    <path
                        fill="currentColor"
                        d="M488 261.8C488 403.3 381.5 512 244 512 109.8 512 0 402.2 0 256S109.8 0 244 0c73.2 0 136.2 29.3 182.4 75.4l-62.4 60.3C337.2 114.6 295.6 96 244 96c-88.6 0-160.1 71.1-160.1 160s71.5 160 160.1 160c97.4 0 134-60.5 138.5-93.2H244v-74.4h239.9c2.4 12.6 3.6 25.8 3.6 40.2z"
                    />
                </svg>
                <span>{buttonLabel}</span>
            </Button>
        </div>
    );
};

export default AuthPrompt;
