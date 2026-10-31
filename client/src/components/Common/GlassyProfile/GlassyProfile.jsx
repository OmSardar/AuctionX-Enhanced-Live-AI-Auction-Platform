import React from "react";

const GlassyProfile = () => {
  return (
    <div className="bg-canvas border-y border-border/40 text-espresso flex justify-center items-center py-16 px-4">
      <h1 className="sr-only">Glassy Profile</h1>
      <input
        type="checkbox"
        id="data"
        className="sr-only peer/data"
        role="switch"
        aria-label="Data Toggle"
      />
      <input
        type="checkbox"
        id="content"
        className="sr-only peer/content"
        role="switch"
        aria-label="Content Toggle"
      />
      <div
        className="z-10 rounded-2xl overflow-hidden group relative
            before:absolute before:w-32 before:aspect-square before:rounded-full before:bg-primary/50 before:blur-lg before:right-3 before:top-0 before:-z-10
            after:absolute after:w-32 after:aspect-square after:rounded-full after:bg-secondary/60 after:blur-lg after:left-4 after:bottom-0 after:-z-10
            peer-checked/data:first:[&_#toggle-data>span]:scale-0
            peer-checked/data:last:[&_#toggle-data>span]:scale-100
            peer-checked/data:[&_#panel-data]:-translate-y-14
            peer-checked/data:[&_#panel-social]:translate-y-12
            peer-checked/content:[&_#panel-content]:opacity-100
            peer-checked/content:[&_#panel-content]:pointer-events-auto shadow-xl"
      >
        <div className="relative bg-surface rounded-2xl bg-clip-padding backdrop-filter backdrop-blur-md bg-opacity-80 border border-sand/40 w-64 p-8 text-center shadow-lg">
          <img
            src="/default-profile.png"
            alt="Profile"
            className="rounded-full mx-auto w-20 h-20 border-4 border-canvas shadow-md opacity-90 group-hover:opacity-100 transition"
          />
          <h3 className="font-bold text-espresso mt-6 text-lg">Mary Jane</h3>
          <p className="flex items-center justify-center gap-1 text-sm text-text-secondary">
            <span className="material-symbols-outlined text-lg text-primary">
              location_on
            </span>
            Atlanta, GA
          </p>
          <label
            htmlFor="content"
            className="btn-canonical btn-canonical-sm btn-canonical-primary w-full mt-4"
          >
            View Content
          </label>
        </div>

        <label
          id="toggle-data"
          htmlFor="data"
          className="grid [grid-template-areas:'stack'] place-content-center absolute top-4 right-4 cursor-pointer hover:scale-125 transition text-espresso/70 hover:text-espresso
                *:[grid-area:stack]
                *:transition-all
                *:duration-300
                *:text-sm
                last:*:scale-0"
        >
          <span className="material-symbols-outlined">density_large</span>
          <span className="material-symbols-outlined">close</span>
        </label>

        <div
          id="panel-data"
          className="absolute -top-4 left-8 right-8 w-8/10 h-40 -z-20 bg-espresso rounded-t-xl text-canvas p-6 pt-4 transition duration-300 shadow-md"
        >
          <p className="font-semibold text-sand">UI designer</p>
          <a href="#" className="text-secondary hover:underline">@mary</a>
        </div>

        <div
          id="panel-social"
          className="absolute transition duration-300 -bottom-4 left-8 right-8 p-6 pb-2 w-8/10 h-20 -z-20 bg-espresso text-sand rounded-b-xl flex items-center justify-between gap-2 [&>svg]:cursor-pointer [&>svg]:w-5 [&>svg]:h-5 [&>svg:hover]:scale-125 [&>svg:hover]:text-canvas [&>svg]:transition shadow-md"
        >
          <svg
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
            <path
              d="M14.058 3.41c-1.807 .767 -2.995 2.453 -3.056 4.38l-.002 .182l-.243 -.023c-2.392 -.269 -4.498 -1.512 -5.944 -3.531a1 1 0 0 0 -1.685 .092l-.097 .186l-.049 .099c-.719 1.485 -1.19 3.29 -1.017 5.203l.03 .273c.283 2.263 1.5 4.215 3.779 5.679l.173 .107l-.081 .043c-1.315 .663 -2.518 .952 -3.827 .9c-1.056 -.04 -1.446 1.372 -.518 1.878c3.598 1.961 7.461 2.566 10.792 1.6c4.06 -1.18 7.152 -4.223 8.335 -8.433l.127 -.495c.238 -.993 .372 -2.006 .401 -3.024l.003 -.332l.393 -.779l.44 -.862l.214 -.434l.118 -.247c.265 -.565 .456 -1.033 .574 -1.43l.014 -.056l.008 -.018c.22 -.593 -.166 -1.358 -.941 -1.358l-.122 .007a.997 .997 0 0 0 -.231 .057l-.086 .038a7.46 7.46 0 0 1 -.88 .36l-.356 .115l-.271 .08l-.772 .214c-1.336 -1.118 -3.144 -1.254 -5.012 -.554l-.211 .084z"
              strokeWidth="0"
              fill="currentColor"
            ></path>
          </svg>

          <svg
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
            <path d="M4 4m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z"></path>
            <path d="M8 11l0 5"></path>
            <path d="M8 8l0 .01"></path>
            <path d="M12 16l0 -5"></path>
            <path d="M16 16v-3a2 2 0 0 0 -4 0"></path>
          </svg>

          <svg
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
            <path
              d="M18 2a1 1 0 0 1 .993 .883l.007 .117v4a1 1 0 0 1 -.883 .993l-.117 .007h-3v1h3a1 1 0 0 1 .991 1.131l-.02 .112l-1 4a1 1 0 0 1 -.858 .75l-.113 .007h-2v6a1 1 0 0 1 -.883 .993l-.117 .007h-4a1 1 0 0 1 -.993 -.883l-.007 -.117v-6h-2a1 1 0 0 1 -.993 -.883l-.007 -.117v-4a1 1 0 0 1 .883 -.993l.117 -.007h2v-1a6 6 0 0 1 5.775 -5.996l.225 -.004h3z"
              strokeWidth="0"
              fill="currentColor"
            ></path>
          </svg>

          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
            <path d="M8 20l4 -9"></path>
            <path d="M10.7 14c.437 1.263 1.43 2 2.55 2c2.071 0 3.75 -1.554 3.75 -4a5 5 0 1 0 -9.7 1.7"></path>
            <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"></path>
          </svg>
        </div>

        <div className="absolute bg-surface inset-0 -z-20 rounded-2xl"></div>

        <div
          id="panel-content"
          className="absolute bg-surface inset-0 opacity-0 pointer-events-none transition-all duration-500 rounded-2xl p-8 space-y-4 border border-sand/40"
        >
          <h2 className="font-bold text-espresso text-lg">Mary Jane</h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            Leading creative seller and collector on Auction X. Specializes in curated antiquities, rare artifacts, and contemporary artisan crafts.
          </p>
          <label
            htmlFor="content"
            className="cursor-pointer absolute top-0 right-4 w-6 h-6 text-base text-sand hover:text-espresso grid place-items-center material-symbols-outlined hover:scale-125 transition"
          >
            close
          </label>
        </div>
      </div>
    </div>
  );
};

export default GlassyProfile;
