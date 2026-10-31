import { useEffect, useState, useRef } from "react";
import gsap from "gsap";
import { TextPlugin } from "gsap/TextPlugin";

gsap.registerPlugin(TextPlugin);

const greetings = [
  "Welcome to Auction X",
  "ऑक्शन एक्स में आपका स्वागत है!",
  "অকশন এক্স-এ আপনাকে স্বাগতম!",
  "オークションXへようこそ！",
  "Добро пожаловать в Auction X!",
  "¡Bienvenido a Auction X!",
  "Bienvenue à Auction X !",
  "Benvenuto su Auction X!",
  "欢迎来到 Auction X！",
  "آکشن ایکس میں خوش آمدید!",
];

const GreetingAnimation = () => {
  const [index, setIndex] = useState(0);
  const greetingRef = useRef(null);

  useEffect(() => {
    const animateGreeting = () => {
      gsap.to(greetingRef.current, {
        duration: 1,
        text: greetings[index],
        onComplete: () => {
          setTimeout(() => {
            setIndex((prevIndex) => (prevIndex + 1) % greetings.length);
          }, 1000);
        },
      });
    };

    animateGreeting();
  }, [index]);

  return (
    <div className="bg-canvas border-b border-border/40 py-6 flex items-center justify-center px-4 text-espresso">
      <div
        ref={greetingRef}
        className="text-xl sm:text-2xl md:text-4xl font-bold text-center text-espresso tracking-tight max-w-[90%] md:max-w-[70%] lg:max-w-[50%]"
      ></div>
    </div>
  );
};

export default GreetingAnimation;
