import React, { useState, useEffect } from "react";

const ModalVideoPlayer = () => {
  const [modalOpen, setModalOpen] = useState(false);

  // Disable/Enable scrolling when modal is toggled
  useEffect(() => {
    if (modalOpen) {
      document.body.style.overflow = "hidden"; // Prevent scrolling
    } else {
      document.body.style.overflow = "auto"; // Restore scrolling
    }

    return () => {
      document.body.style.overflow = "auto"; // Cleanup on unmount
    };
  }, [modalOpen]);

  return (
    <div className="relative font-inter antialiased">
      <main className="relative min-h-screen flex flex-col justify-center bg-slate-50 overflow-hidden">
        <div className="w-full max-w-6xl mx-auto px-4 md:px-6 py-24">
          <div className="flex justify-center">
            {/* Video thumbnail */}
            <button
              className="relative flex justify-center items-center focus:outline-none focus-visible:ring focus-visible:ring-indigo-300 rounded-3xl group"
              onClick={() => setModalOpen(true)}
              aria-controls="modal"
              aria-label="Watch the video"
            >
              <img
                className="rounded-3xl shadow-2xl transition-shadow duration-300 ease-in-out"
                src="/video-poster.svg"
                width="768"
                height="432"
                alt="Modal video thumbnail"
              />
              {/* Play icon */}
              <svg
                className="absolute pointer-events-none group-hover:scale-110 transition-transform duration-300 ease-in-out"
                xmlns="http://www.w3.org/2000/svg"
                width="72"
                height="72"
              >
                <circle className="fill-white" cx="36" cy="36" r="36" fillOpacity=".8" />
                <path
                  className="fill-indigo-500 drop-shadow-2xl"
                  d="M44 36a.999.999 0 0 0-.427-.82l-10-7A1 1 0 0 0 32 29V43a.999.999 0 0 0 1.573.82l10-7A.995.995 0 0 0 44 36V36c0 .001 0 .001 0 0Z"
                />
              </svg>
            </button>
          </div>
        </div>
      </main>

      {/* Modal with Transparent Background */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-transparent"
          onClick={() => setModalOpen(false)}
        >
          {/* Modal content (Prevents clicking inside the video from closing) */}
          <div
            className="relative rounded-3xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <video width="768" height="432" loop controls autoPlay className="rounded-3xl">
              <source
                src="https://cruip-tutorials.vercel.app/modal-video/video.mp4"
                type="video/mp4"
              />
              Your browser does not support the video tag.
            </video>
            {/* Close Button */}
            <button
              className="absolute top-4 right-4 text-white bg-gray-800 p-2 rounded-full"
              onClick={() => setModalOpen(false)}
            >
              ✖
            </button>
          </div>
        </div>
      )}

      {/* Page footer */}
      <footer className="absolute left-6 right-6 md:left-12 md:right-auto bottom-4 md:bottom-8 text-center md:text-left">
        <a
          className="text-xs text-slate-500 hover:underline"
          href="https://cruip.com"
        >
          &copy;Cruip - Tailwind CSS templates
        </a>
      </footer>
    </div>
  );
};

export default ModalVideoPlayer;
