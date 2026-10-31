import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "aos/dist/aos.css"; // Import AOS CSS
import AOS from "aos"; // Import AOS library
import { useThemeProvider } from "../../../../AdminDashboard/utils/ThemeContext"; // Adjust path as needed
import ModalVideoPlayer from "../../../../../components/Modals/ModalVideoPlayer/ModalVideoPlayer";
import DoublePopups from "../../../../../components/User/DoublePopups/DoublePopups";
import ChatQnA from "../../../../../components/Common/ChatQnA/ChatQnA";
import AboutUs2 from "../AboutUs2/AboutUs2";
import SellerBanner2 from "../../../../SellerComponents/SellerBanner/SellerBanner2/SellerBanner2";
import SellerBanner3 from "../../../../SellerComponents/SellerBanner/SellerBanner3/SellerBanner3";
import SellerFooter from "../../../../../pages/Seller/Layouts/SellerFooter/SellerFooter";
import SellerSupport from "../../../../SellerComponents/SellerSupport/SellerSupport";
import OurReach from "../OurReach/OurReach";

const AboutUs1 = () => {
  const navigate = useNavigate();
  const { currentTheme } = useThemeProvider();

  // Initialize AOS when the component mounts
  useEffect(() => {
    AOS.init(
      {
        duration: 1000, // Animation duration
        offset: 100,
        once: false, // Allow animations to happen every time elements scroll in/out
        mirror: true, // Enable mirror effect (fade out when scrolling out)
      },
      500
    );
  }, []);

  return (
    <div className="relative font-inter antialiased bg-canvas text-foreground pt-16 lg:pt-20 transition-colors duration-300">
      <main className="relative min-h-screen flex flex-col justify-center bg-canvas overflow-hidden transition-colors duration-300">
        <div className="w-full max-w-full mx-auto px-6 md:px-16 py-24">
          <div className="text-center mb-50 pt-50" data-aos="zoom-in">
            <h1 className="text-5xl font-bold text-foreground mb-4 transition-colors duration-300">
              AuctionX
            </h1>
            <p className="text-xl text-foreground-secondary transition-colors duration-300">
              An AI-Powered Live Auction Platform &amp; Full-Stack Engineering Demonstration
            </p>
          </div>

          <article className="max-w-5xl mx-auto space-y-12">
            <header className="text-center" data-aos="fade-up">
              <h2 className="text-4xl font-extrabold text-foreground transition-colors duration-300">
                Our Story
              </h2>
            </header>
            <div className="text-foreground-secondary space-y-8 transition-colors duration-300">
              <p data-aos="fade-up" className="leading-relaxed">
                Once upon a time, in a bustling city, our founders lived and
                breathed software development. The world of coding fascinated
                them, and they were determined to leave their mark on it. With a
                passion for innovation and a desire to create, they embarked on
                a journey that would forever change their lives.
              </p>
              <div
                className="flex flex-col sm:flex-row items-center space-y-6 sm:space-y-0 sm:space-x-8"
                data-aos="fade-right"
              >
                <figure className="shrink-0 sm:max-w-[350px] rounded-2xl overflow-hidden">
                  <img
                    className="object-cover rounded-2xl w-full"
                    src="/story-journey.svg"
                    alt="Innovation"
                  />
                </figure>
                <blockquote className="text-lg italic">
                  <p>
                    Looking back, we realized that success isn't just about
                    numbers or recognition—it's about impact, innovation, and
                    the relationships we build along the way.
                  </p>
                </blockquote>
              </div>
            </div>
            <p data-aos="fade-up" className="leading-relaxed text-slate-600 dark:text-slate-300 transition-colors duration-300">
              In the heart of a vibrant city, amidst the hustle and bustle,
              there I was, Alex, completely immersed in the world of software
              development. The realm of coding held an irresistible allure,
              captivating my every thought and action. Driven by a profound
              passion for innovation and an unwavering desire to make a lasting
              impact, I set forth on a transformative journey that would shape
              the course of my existence.
            </p>
            <div
              className="flex flex-col sm:flex-row items-center space-y-6 sm:space-y-0 sm:space-x-8"
              data-aos="fade-left"
            >
              <p className="leading-relaxed text-slate-600 dark:text-slate-300 transition-colors duration-300">
                Today, as a successful software developer with two thriving
                startups under my belt, I continue to embrace new challenges and
                opportunities. But above all, I remain committed to sharing my
                knowledge, empowering others, and making a lasting impact on the
                world.
              </p>
              <figure className="shrink-0 sm:max-w-[350px] rounded-2xl overflow-hidden">
                <img
                  className="object-cover rounded-2xl w-full"
                  src="/story-impact.svg"
                  alt="Article 02"
                />
              </figure>
            </div>
            <p data-aos="fade-up" className="leading-relaxed text-slate-600 dark:text-slate-300 transition-colors duration-300">
              The sleepless nights spent debugging, the countless hours spent
              refining algorithms...
            </p>
            <figure
              className="md:-mx-12 rounded-2xl overflow-hidden w-full flex flex-col items-center"
              data-aos="zoom-in"
            >
              <img
                className="object-cover rounded-2xl w-full max-w-[900px]"
                src="/story-tranquility.svg"
                alt="Article 03"
              />
              <figcaption className="text-center text-sm mt-2 text-slate-600 dark:text-slate-400 transition-colors duration-300">
                Moments of tranquility amidst nature's beauty
              </figcaption>
            </figure>
          </article>

          <div className="mt-30" data-aos="fade-up">
            <h2 className="text-3xl font-bold text-foreground text-center mb-8 transition-colors duration-300">
              Our Core Values
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  title: "Innovation",
                  img: "/value-innovation.svg",
                  desc: "We push boundaries to deliver cutting-edge solutions.",
                },
                {
                  title: "Integrity",
                  img: "/value-integrity.svg",
                  desc: "Honesty, transparency, and ethical practices guide us.",
                },
                {
                  title: "Excellence",
                  img: "/value-excellence.svg",
                  desc: "We strive for the highest standards in everything we do.",
                },
              ].map((value, index) => (
                <div
                  key={index}
                  className="bg-surface border border-border-subtle rounded-xl shadow-xs p-6 text-center transition-colors duration-300"
                  data-aos="fade-up"
                  data-aos-delay={200 * (index + 1)}
                >
                  <img
                    className="w-20 h-20 mx-auto mb-4 rounded-full object-cover border border-border-subtle"
                    src={value.img}
                    alt={value.title}
                  />
                  <h3 className="text-2xl font-semibold text-foreground mb-4 transition-colors duration-300">
                    {value.title}
                  </h3>
                  <p className="text-foreground-secondary transition-colors duration-300">
                    {value.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div
            className="bg-surface-dark border border-border-subtle rounded-xl shadow-warm-lg p-8 sm:p-12 text-center mt-16 transition-colors duration-300"
            data-aos="fade"
          >
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to Experience Live Auctions?
            </h2>
            <p className="text-lg text-sand/80 max-w-2xl mx-auto mb-6 transition-colors duration-300">
              Discover verified lots, authentic sellers, and real-time bidding. Have questions or need support? We're here to help.
            </p>
            <button
              onClick={() => navigate("/contact")}
              className="inline-flex items-center justify-center bg-action-primary hover:bg-action-primary-hover text-white font-semibold py-2.5 px-6 rounded-lg shadow-xs transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus"
            >
              Get in Touch
            </button>
          </div>
        </div>
      </main>
      <div>
        <ModalVideoPlayer />
      </div>
      <div>
        <DoublePopups />
      </div>
      <div>
        {/* <ChatQnA /> */}
      </div>
      <div>
        <AboutUs2 />
      </div>
      <div>
        <OurReach />
      </div>
      
    </div>
  );
};

export default AboutUs1;