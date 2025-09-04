import { createContext, useContext, useState } from "react";
import { Toast, Alert } from "react-daisyui";

// 允许的消息类型
type MessageType = "success" | "error" | "warning" | "info";

interface ToastMessage {
  id: number;
  type: MessageType;
  message: string;
	isAutoClose?: boolean;
}

interface ToastContextProps {
  toast: ({type, message, isAutoClose}: {type: MessageType, message: string, isAutoClose?: boolean}) => void;
}

const ToastContext = createContext<ToastContextProps | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // 触发 Toast
  const addToast = ({
		type,
		message,
		isAutoClose = true
	}: {
		type: MessageType,
		message: string,
		isAutoClose?: boolean,
	}) => {
    const id = Date.now();

    setToasts((prev) => [...prev, { id, type, message, isAutoClose }]);

		if (isAutoClose) {
			// 3秒后自动移除
			setTimeout(() => {
				setToasts((prev) => prev.filter((t) => t.id !== id));
			}, 3000);
		}
  };

  
	const handleRemoveToast = (id: number) => {
		setToasts((prev) => prev.filter((t) => t.id !== id));
	};
	
  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}

      <Toast horizontal="end" vertical="top" className="z-50">
        {toasts.map(({ id, type, message }) => (
          <Alert 
            key={id} 
            status={type}
						className="p-3 gap-1 max-w-[400px] whitespace-normal"
						icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
						</svg>}
          >
           	<div className="w-full flex-row justify-between mr-2 overflow-hidden">
              <h3 className="text-sm break-all whitespace-normal overflow-wrap-anywhere">{message}</h3>
            </div>
						<span className="cursor-pointer" onClick={() => handleRemoveToast(id)}>
							<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
						</span>
          </Alert>
        ))}
      </Toast>
    </ToastContext.Provider>
  );
}

// 自定义 Hook 方便调用
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};
