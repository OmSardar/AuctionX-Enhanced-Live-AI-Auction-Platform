import React from 'react';

const DoublePopups = () => {
  return (
    <div className="bg-gradient-to-tr from-[#2B2B43] via-[#1E252F] to-[#362140] text-slate-100 flex justify-center items-center min-h-screen p-4">
      <input className="peer/option1 sr-only" id="option-1" type="radio" name="panel" defaultChecked />
      <input className="peer/option2 sr-only" id="option-2" type="radio" name="panel" />
      <input className="peer/option3 sr-only" id="option-3" type="radio" name="panel" />

      <main className="grid [grid-template-areas:'stack'] 
            [&>section]:[grid-area:stack]
            [&>section]:bg-[#2A373E]
            [&>section]:flex 
            [&>section]:flex-col
            [&>section]:p-4
            sm:[&>section]:p-8
            sm:[&>section]:py-12
            [&>section]:shadow-lg
            [&>section]:w-full
            [&>section]:max-w-xs
            [&>section]:text-center
            [&>section]:relative
            [&>section]:transition-all
            [&>section]:duration-500
            [&>section]:ease-in-out
            [&_header]:space-y-4
            [&_header]:mb-12
            [&_header>svg]:w-24
            [&_header>svg]:mx-auto
            [&_header>svg]:transition-all
            [&_header>svg]:duration-300
            [&_h2]:font-bold
            [&_h2]:text-xl
            [&_h2]:uppercase
            [&_h2]:mb-4
            [&_p]:line-clamp-3
            [&_p]:mb-20
            [&_label]:mt-auto
            [&_label]:w-fit
            [&_label]:border
            [&_label]:border-slate-500
            [&_label]:rounded-md
            [&_label]:py-1
            [&_label]:px-2
            [&_label]:text-slate-500
            [&_label]:transition-all
            [&_label]:duration-300
            hover:[&_label]:border-white
            hover:[&_label]:text-white
            [&_.dots]:mt-auto
            [&_.dots]:my-12
            [&_.dots]:flex
            [&_.dots]:gap-2
            [&_.dots]:justify-center
            [&_.dots>span]:rounded-full 
            [&_.dots>span]:w-2
            [&_.dots>span]:h-2
            [&_.dots>span]:transition-all
            [&_.dots>span]:duration-300
            [&_.dots>span]:delay-500
            [&_.dots>span]:bg-[#1C252B]
            focus:[&_label]:outline-none
            focus:[&_label]:ring-0
            [&>section#panel-1]:bg-[#D52EBD]
            peer-checked/option1:[&>section#panel-1_.dots>span.current]:bg-[#D52EBD]
            [&>section#panel-2]:bg-[#E6007B]
            peer-checked/option2:[&>section#panel-2_.dots>span.current]:bg-[#E6007B]
            [&>section#panel-3]:bg-[#8D51DD]
            peer-checked/option3:[&>section#panel-3_.dots>span.current]:bg-[#8D51DD]
            [&_label]:cursor-pointer
            peer-checked/option1:[&>section#panel-1]:scale-100
            peer-checked/option1:[&>section#panel-1]:opacity-100
            peer-checked/option1:[&>section#panel-1]:translate-y-0
            peer-checked/option1:[&>section#panel-1]:z-10
            peer-checked/option1:[&>section#panel-2]:scale-[80%]
            peer-checked/option1:[&>section#panel-2]:-translate-y-16
            sm:peer-checked/option1:[&>section#panel-2]:-translate-y-20
            sm:peer-checked/option1:[&>section#panel-2]:translate-x-60
            peer-checked/option1:[&>section#panel-2]:opacity-30
            peer-checked/option1:[&>section#panel-2]:z-0
            peer-checked/option1:[&>section#panel-3]:scale-[60%]
            sm:peer-checked/option1:[&>section#panel-3]:scale-[80%]
            peer-checked/option1:[&>section#panel-3]:-translate-y-32
            sm:peer-checked/option1:[&>section#panel-3]:-translate-x-60
            peer-checked/option1:[&>section#panel-3]:opacity-30
            peer-checked/option1:[&>section#panel-3]:z-0
            peer-checked/option2:[&>section#panel-2]:scale-100
            peer-checked/option2:[&>section#panel-2]:opacity-100
            peer-checked/option2:[&>section#panel-2]:translate-y-0
            peer-checked/option2:[&>section#panel-2]:z-10
            peer-checked/option2:[&>section#panel-3]:scale-[80%]
            peer-checked/option2:[&>section#panel-3]:-translate-y-16
            sm:peer-checked/option2:[&>section#panel-3]:-translate-y-20
            sm:peer-checked/option2:[&>section#panel-3]:translate-x-60
            peer-checked/option2:[&>section#panel-3]:opacity-30
            peer-checked/option2:[&>section#panel-3]:z-0
            peer-checked/option2:[&>section#panel-1]:scale-[60%]
            sm:peer-checked/option2:[&>section#panel-1]:scale-[80%]
            peer-checked/option2:[&>section#panel-1]:-translate-y-32
            sm:peer-checked/option2:[&>section#panel-1]:-translate-x-60
            peer-checked/option2:[&>section#panel-1]:opacity-30
            peer-checked/option2:[&>section#panel-1]:z-0
            peer-checked/option3:[&>section#panel-3]:scale-100
            peer-checked/option3:[&>section#panel-3]:opacity-100
            peer-checked/option3:[&>section#panel-3]:translate-y-0
            peer-checked/option3:[&>section#panel-3]:z-10
            peer-checked/option3:[&>section#panel-1]:scale-[80%]
            peer-checked/option3:[&>section#panel-1]:-translate-y-16
            sm:peer-checked/option3:[&>section#panel-1]:-translate-y-20
            sm:peer-checked/option3:[&>section#panel-1]:translate-x-60
            peer-checked/option3:[&>section#panel-1]:opacity-30
            peer-checked/option3:[&>section#panel-1]:z-0
            peer-checked/option3:[&>section#panel-2]:scale-[60%]
            sm:peer-checked/option3:[&>section#panel-2]:scale-[80%]
            peer-checked/option3:[&>section#panel-2]:-translate-y-32
            sm:peer-checked/option3:[&>section#panel-2]:-translate-x-60
            peer-checked/option3:[&>section#panel-2]:opacity-30
            peer-checked/option3:[&>section#panel-2]:z-0">
        <h1 className="sr-only">Double Popups</h1>
        <section id="panel-1">
          <header>
            <svg fill="currentColor" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 511.998 511.998" xml:space="preserve">
              {/* SVG Paths for Panel 1 */}
            </svg>
            <h2>Grow your team</h2>
          </header>
          <p>Ab amet commodi nesciunt sed natus iusto quidem voluptatem beatae eius quasi iure nemo voluptates est repellat delectus culpa, dolore, quia hic quod provident modi odio fuga laudantium nobis?</p>
          <div className="dots">
            <span className="current"></span>
            <span></span>
            <span></span>
          </div>
          <label htmlFor="option-2" className="w-fit border rounded-md py-1 px-2 text-slate-300 transition-all duration-300 hover:text-white hover:border-white focus:text-white focus:border-white">skip</label>
          <svg className="absolute w-full h-4/5 left-0 bottom-0 -z-10" viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" overflow="auto" shapeRendering="auto" fill="#ffffff">
            {/* SVG Paths for Wave Animation */}
          </svg>
        </section>

        <section id="panel-2">
          <header>
            <svg fill="currentColor" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512" xml:space="preserve">
              {/* SVG Paths for Panel 2 */}
            </svg>
            <h2>Plan your project</h2>
          </header>
          <p>Animi aut perspiciatis expedita. Quaerat, beatae? Ipsam aliquid error quaerat deleniti itaque alias nostrum id corrupti tempore exercitationem.</p>
          <div className="dots">
            <span></span>
            <span className="current"></span>
            <span></span>
          </div>
          <label htmlFor="option-3" className="w-fit border rounded-md py-1 px-2 text-slate-300 transition-all duration-300 hover:text-white hover:border-white focus:text-white focus:border-white">skip</label>
          <svg className="absolute w-full h-4/5 left-0 bottom-0 -z-10" viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" overflow="auto" shapeRendering="auto" fill="#ffffff">
            {/* SVG Paths for Wave Animation */}
          </svg>
        </section>

        <section id="panel-3">
          <header>
            <svg fill="currentColor" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512.001 512.001" xml:space="preserve">
              {/* SVG Paths for Panel 3 */}
            </svg>
            <h2>Release your project</h2>
          </header>
          <p>Lorem ipsum dolor sit amet consectetur adipisicing elit. Vero itaque dolor velit iste totam beatae architecto corporis temporibus exercitationem molestiae.</p>
          <div className="dots">
            <span></span>
            <span></span>
            <span className="current"></span>
          </div>
          <label htmlFor="option-1" className="w-fit border rounded-md py-1 px-2 text-slate-300 transition-all duration-300 hover:text-white hover:border-white focus:text-white focus:border-white">skip</label>
          <svg className="absolute w-full h-4/5 left-0 bottom-0 -z-10" viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" overflow="auto" shapeRendering="auto" fill="#ffffff">
            {/* SVG Paths for Wave Animation */}
          </svg>
        </section>
      </main>
    </div>
  );
};

export default DoublePopups;