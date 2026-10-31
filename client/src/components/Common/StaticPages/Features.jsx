import React from "react";

const Features = () => {
  return (
    <div className="py-12 bg-canvas">
      <div className="relative m-auto w-full max-w-screen-sm overflow-hidden rounded-3xl bg-espresso p-8 font-light text-canvas shadow-xl border border-sand/20">
        <div className="absolute -left-[40%] top-0 h-[800px] w-[800px] -translate-y-[600px] transform rounded-full bg-primary-800 opacity-60 blur-3xl" />
        <div className="absolute left-0 top-0 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 transform rounded-full bg-primary opacity-50 blur-3xl" />
        <div className="absolute left-0 top-[75px] h-[250px] w-[200px] -translate-x-1/2 transform rounded-[100%] bg-gradient-to-b from-secondary/50 via-primary/40 to-primary-800/80 opacity-70 blur-3xl" />
        <div className="relative z-10 flex justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-canvas p-2 text-espresso shadow-sm">
              <svg
                data-name="Layer 1"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 128 128"
                className="h-8 w-8"
              >
                <path
                  fill="currentColor"
                  d="M36.293 53.875a27.936 27.936 0 0 1 26.85-25.961c.289-.009.576-.013.864-.013a27.761 27.761 0 0 1 27.756 27.763 27.909 27.909 0 0 1-13.576 23.859 7.833 7.833 0 0 0-3.825 6.683v3.032a.086.086 0 0 1-.085.086h-2.99l4.2-23.706v-.005l1.364-7.7a2 2 0 1 0-3.938-.7L71.677 64.2c-1.616 1.256-3.29.536-6.637-1.38-2.612-1.5-5.976-3.408-9.346-2.179l-.607-3.422a2 2 0 1 0-3.938.7l1.135 6.4 4.432 25h-2.99a.086.086 0 0 1-.085-.086v-3.028a7.764 7.764 0 0 0-3.778-6.653 27.71 27.71 0 0 1-13.57-25.677zm38.842 39.449a2.021 2.021 0 0 1 0 4.041h-22.27a2.021 2.021 0 0 1 0-4.041h22.27zm2.021 10.062a2.023 2.023 0 0 1-2.021 2.021h-22.27a2.021 2.021 0 0 1 0-4.042h22.27a2.023 2.023 0 0 1 2.021 2.021zM60.777 89.324l-4.36-24.6c1.644-1.07 3.372-.306 6.635 1.563 2 1.145 4.447 2.547 6.981 2.546a6.581 6.581 0 0 0 .833-.059l-3.643 20.55zm4.058 30.106h-1.669a3.984 3.984 0 0 1-3.442-1.982h8.554a3.984 3.984 0 0 1-3.444 1.983zm10.3-5.982h-22.27a2.021 2.021 0 1 1 0-4.041h22.27a2.021 2.021 0 1 1 0 4.041zM66 16.858V6.569a2 2 0 1 0-4 0v10.289a2 2 0 1 0 4 0zm-38.758 46.58a2 2 0 0 0-2-2H14.953a2 2 0 0 0 0 4h10.289a2 2 0 0 0 2-2zM32.291 33.5a2 2 0 0 0 0-2.828L25.016 23.4a2 2 0 0 0-2.828 2.828l7.275 7.272a2 2 0 0 0 2.828 0zm82.756 29.937a2 2 0 0 0-2-2h-10.289a2 2 0 0 0 0 4h10.289a2 2 0 0 0 2-1.999zM98.537 33.5l7.275-7.275a2 2 0 0 0-2.828-2.828l-7.275 7.275a2 2 0 1 0 2.828 2.828z"
                />
              </svg>
            </div>
            <div className="text-xl text-sand font-medium">Insight</div>
          </div>
          <div className="flex items-center gap-4">
            <form>
              <label htmlFor="when" className="sr-only">
                when
              </label>
              <div className="relative">
                <select
                  id="when"
                  name="when"
                  autoComplete="when"
                  className="block w-full cursor-pointer appearance-none rounded-3xl border-0 bg-transparent px-6 py-3 pr-10 shadow-sm outline-none ring-1 ring-inset ring-sand/40 text-canvas focus:ring-primary"
                >
                  <option className="bg-espresso text-canvas">This Week</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 mr-5 flex items-center text-sand">
                  <svg className="h-3 w-3" viewBox="0 0 407.437 407.437">
                    <polygon
                      fill="currentColor"
                      points="386.258,91.567 203.718,273.512 21.179,91.567 0,112.815 203.718,315.87 407.437,112.815 "
                    />
                  </svg>
                </div>
              </div>
            </form>
            <div className="h-full">
              <button className="relative h-full rounded-full px-6 outline-none ring-1 ring-inset ring-sand/40 text-canvas hover:ring-primary focus:ring-primary">
                <div className="sr-only">Menu</div>
                <svg
                  className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 transform"
                  viewBox="0 0 24 24"
                >
                  <path
                    fill="currentColor"
                    d="M18 12H18.01M12 12H12.01M6 12H6.01M13 12C13 12.5523 12.5523 13 12 13C11.4477 13 11 12.5523 11 12C11 11.4477 11.4477 11 12 11C12.5523 11 13 11.4477 13 12ZM19 12C19 12.5523 18.5523 13 18 13C17.4477 13 17 12.5523 17 12C17 11.4477 17.4477 11 18 11C18.5523 11 19 11.4477 19 12ZM7 12C7 12.5523 6.55228 13 6 13C5.44772 13 5 12.5523 5 12C5 11.4477 5.44772 11 6 11C6.55228 11 7 11.4477 7 12Z"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
        <div className="relative z-10 my-20 flex text-8xl text-secondary">
          <div className="font-light text-canvas">89%</div>
          <svg className="h-16 w-16" viewBox="0 0 24 24">
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M9 6.75C8.58579 6.75 8.25 6.41421 8.25 6C8.25 5.58579 8.58579 5.25 9 5.25H18C18.4142 5.25 18.75 5.58579 18.75 6V15C18.75 15.4142 18.4142 15.75 18 15.75C17.5858 15.75 17.25 15.4142 17.25 15V7.81066L6.53033 18.5303C6.23744 18.8232 5.76256 18.8232 5.46967 18.5303C5.17678 18.2374 5.17678 17.7626 5.46967 17.4697L16.1893 6.75H9Z"
              fill="currentColor"
            />
          </svg>
        </div>
        <p className="relative z-10 text-2xl font-light text-canvas">
          increase in your revenue{" "}
          <span className="opacity-70 text-sand">
            by the end of this month is forecasted.
          </span>
        </p>
        <p className="relative z-10 mt-4 text-lg font-light leading-tight text-sand/80">
          Harver is about to receive 15K new customers <br />
          which results in 78% increase in revenue.
        </p>
        <nav
          aria-label="cards"
          className="relative z-10 mt-24 flex items-center justify-between text-sand"
        >
          <button className="hover:text-canvas transition-colors">
            <svg className="h-8 w-8" viewBox="0 0 1024 1024">
              <path
                fill="currentColor"
                d="M604.7 759.2l61.8-61.8L481.1 512l185.4-185.4-61.8-61.8L357.5 512z"
              />
            </svg>
          </button>
          <div className="flex flex-wrap justify-center gap-2">
            <div className="h-2 w-16 rounded-xl bg-sand/30" />
            <div className="h-2 w-16 rounded-xl bg-primary" />
            <div className="h-2 w-16 rounded-xl bg-sand/30" />
            <div className="h-2 w-16 rounded-xl bg-sand/30" />
            <div className="h-2 w-16 rounded-xl bg-sand/30" />
          </div>
          <button className="hover:text-canvas transition-colors">
            <svg className="h-8 w-8" viewBox="0 0 1024 1024">
              <path
                fill="currentColor"
                d="M419.3 264.8l-61.8 61.8L542.9 512 357.5 697.4l61.8 61.8L666.5 512z"
              />
            </svg>
          </button>
        </nav>
      </div>
    </div>
  );
};

export default Features;
