// src/components/GlobalLoading.jsx
import { useSelector } from "react-redux";

const GlobalLoading = () => {
  const { isLoading, loadingMessage } = useSelector((state) => state.loading);

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xl flex flex-col items-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        <p className="text-gray-800 dark:text-gray-200">{loadingMessage}</p>
      </div>
    </div>
  );
};

export default GlobalLoading;
