import { useState } from "react";
import { Clipboard, Check } from "lucide-react";

const Copy = () => {
  const [copied, setCopied] = useState(false);
  const text = window.location.href; // Get the current URL

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
    } catch (error) {
      console.error("Failed to copy text: ", error);
    }
  };

  return (
    <div className="flex flex-col items-center space-y-2 bg-gray-100 p-2 rounded-lg">
      <button
        onClick={handleCopy}
        className="p-2 bg-gray-800 text-white rounded-lg transition duration-200 flex items-center space-x-2"
      >
        {copied ? <Check size={20} /> : <Clipboard size={20} />}
        {/* <span>{copied ? "Copied!" : "Copy URL"}</span> */}
      </button>
    </div>
  );
};

export default Copy;