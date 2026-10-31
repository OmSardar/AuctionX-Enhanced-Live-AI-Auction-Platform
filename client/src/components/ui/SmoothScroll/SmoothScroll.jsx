const SmoothScroll = ({ to, label }) => {
    const handleScroll = () => {
      const section = document.getElementById(to);
      if (section) {
        window.scrollTo({
          top: section.offsetTop,
          behavior: "smooth",
        });
      }
    };
  
    return <button onClick={handleScroll}>{label}</button>;
  };
  
  export default SmoothScroll;
  