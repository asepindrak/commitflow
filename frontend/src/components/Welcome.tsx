import SplitText from "./SplitText";

const handleAnimationComplete = () => {
  console.log("All letters have animated!");
};

function Welcome() {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex gap-2 items-center">
        <img
          src="logo.png"
          className="text-white"
          width={37}
          height={30}
          alt="logo"
        />
        <SplitText
          text="CommitFlow"
          className="text-2xl font-semibold text-center"
          delay={100}
          duration={0.6}
          ease="power3.out"
          splitType="chars"
          from={{ opacity: 0, y: 40 }}
          to={{ opacity: 1, y: 0 }}
          threshold={0.1}
          rootMargin="-100px"
          textAlign="center"
          onLetterAnimationComplete={handleAnimationComplete}
        />
      </div>
      <SplitText
        text="Your Personal Insight."
        className="text-sm text-gray-300 text-center"
        delay={150} // bisa kasih sedikit delay supaya muncul setelah judul
        duration={0.5}
        ease="power3.out"
        splitType="words" // bisa split per kata supaya lebih smooth
        from={{ opacity: 0, y: 20 }}
        to={{ opacity: 1, y: 0 }}
        threshold={0.1}
        rootMargin="-100px"
        textAlign="center"
      />
    </div>
  );
}

export default Welcome;
