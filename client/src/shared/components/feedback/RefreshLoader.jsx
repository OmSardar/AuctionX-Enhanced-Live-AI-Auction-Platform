// src/components/RefreshLoader.jsx
const RefreshLoader = () => {
  return (
    <div className="fixed top-0 left-0 right-0 h-1 z-[9999] overflow-hidden pointer-events-none">
      <div
        className="h-full bg-gradient-to-r from-[#D97A56] via-[#C65D3A] to-[#7F3828] shadow-[0_0_8px_rgba(198,93,58,0.6)] animate-refresh-load"
        style={{
          animation: "refresh-load 0.8s ease-out forwards",
        }}
      />
    </div>
  );
};

export default RefreshLoader;