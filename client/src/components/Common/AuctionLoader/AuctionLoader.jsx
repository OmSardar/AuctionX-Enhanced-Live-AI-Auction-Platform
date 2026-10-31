import { motion } from "framer-motion";

const AuctionLoader = () => {
  return (
    <div className="fixed top-0 left-0 w-full h-full bg-white bg-opacity-90 flex items-center justify-center z-50">
      <div className="flex space-x-1 text-4xl font-bold">
        {[...'AuctionX'].map((letter, index) => (
          <motion.span
            key={index}
            className="letter"
            animate={{ opacity: [0.2, 1, 0.2] }}
            transition={{ duration: 1, ease: "easeInOut", repeat: Infinity, delay: index * 0.1 }}
          >
            {letter}
          </motion.span>
        ))}
      </div>
    </div>
  );
};

export default AuctionLoader;
