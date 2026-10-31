import React, { useState, useEffect } from "react";
import avatarKunal from "../../../../../assets/images/FooterElements/AboutUs/KunalSarkar.jpg";
import avatarOm from "../../../../../assets/images/FooterElements/AboutUs/OmSardar.jpg";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLinkedin, faGithub, faTwitter } from "@fortawesome/free-brands-svg-icons";
import { faEnvelope } from "@fortawesome/free-solid-svg-icons";
import axios from "axios";

// Default authoritative fallback data for Kunal Sarkar and Om Sardar
const initialVerifiedTeam = [
  {
    _id: "default-kunal",
    name: "Kunal Sarkar",
    role: "Lead Developer / Technical Strategist",
    bio: "Passionate Graphic & Branding Designer and Full Stack Developer, blending creativity and technical expertise to craft impactful solutions.",
    imageUrl: avatarKunal,
    socialLinks: {
      linkedin: "https://www.linkedin.com/in/kunal-sarkar-592a1230a/",
      github: "https://github.com/kunalsarkar-bit",
      email: "kunalsarkar6290@gmail.com",
      twitter: "",
    },
    displayOrder: 0,
  },
  {
    _id: "default-om",
    name: "Om Sardar",
    role: "Lead Full-Stack Developer",
    bio: "Passionate engineer with deep proficiency in React, Node.js, Python, OOP, and distributed systems, committed to scalable marketplace architecture.",
    imageUrl: avatarOm,
    socialLinks: {
      linkedin: "https://www.linkedin.com/in/om-sardar",
      github: "https://github.com/OM-SARDAR",
      email: "omsardar14@gmail.com",
      twitter: "",
    },
    displayOrder: 1,
  },
];

const AboutUs3 = () => {
  const [members, setMembers] = useState(initialVerifiedTeam);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchTeamMembers = async () => {
      try {
        const response = await axios.get("/api/team", { timeout: 5000 });
        if (isMounted && response.data?.success && Array.isArray(response.data.data) && response.data.data.length > 0) {
          // Normalize image URLs: map default relative asset paths to bundled images if applicable
          const mapped = response.data.data.map((m) => {
            let img = m.imageUrl;
            if (img && img.includes("KunalSarkar")) img = avatarKunal;
            else if (img && img.includes("OmSardar")) img = avatarOm;
            return {
              ...m,
              resolvedImage: img || avatarOm,
            };
          });
          setMembers(mapped);
        }
      } catch (err) {
        // Graceful fallback to verified initial team on network or offline scenarios
        console.warn("Unable to fetch live team members from API, using verified local profiles:", err.message);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchTeamMembers();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section className="w-full bg-surface text-foreground py-16 px-4 transition-colors duration-200">
      <div className="max-w-5xl mx-auto">
        {/* Header Section */}
        <div className="text-center mb-12">
          <span className="inline-block text-xs uppercase tracking-wider font-semibold text-action-primary bg-action-primary/10 px-3.5 py-1.5 rounded-full mb-3 border border-action-primary/20">
            Core Leadership & Engineering
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold font-display text-foreground tracking-tight">
            Meet the Builders Behind AuctionX
          </h2>
          <p className="text-sm sm:text-base text-foreground-secondary max-w-xl mx-auto mt-3 leading-relaxed">
            The dedicated developers architecting, building, and scaling our next-generation live auction experience.
          </p>
        </div>

        {/* Responsive, Balanced 2-Column Team Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto justify-center items-stretch">
          {members.map((member) => {
            const imageSrc =
              member.resolvedImage ||
              member.imageUrl ||
              (member.name?.toLowerCase().includes("kunal") ? avatarKunal : avatarOm);

            const linkedinUrl = member.socialLinks?.linkedin || member.linkedin;
            const githubUrl = member.socialLinks?.github || member.github;
            const emailAddr = member.socialLinks?.email || member.email;
            const twitterUrl = member.socialLinks?.twitter || member.twitter;

            return (
              <div
                key={member._id || member.name}
                className="bg-surface-subtle border border-border-subtle rounded-2xl p-8 shadow-warm-xs hover:border-action-primary/50 hover:shadow-warm-md transition-all duration-300 flex flex-col justify-between text-center group relative overflow-hidden"
              >
                {/* Accent glow on hover */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-action-primary/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                <div>
                  <div className="relative inline-block mb-5">
                    <img
                      src={imageSrc}
                      alt={member.name}
                      loading="lazy"
                      className="w-28 h-28 rounded-full object-cover mx-auto ring-4 ring-action-primary/20 group-hover:ring-action-primary/50 transition-all duration-300 shadow-warm-sm"
                    />
                  </div>

                  <h3 className="text-xl font-bold font-display text-foreground group-hover:text-action-primary transition-colors duration-200">
                    {member.name}
                  </h3>
                  <p className="text-xs font-semibold uppercase tracking-wider text-action-primary mb-4 mt-1">
                    {member.role}
                  </p>
                  <p className="text-sm text-foreground-secondary leading-relaxed mb-6 font-normal">
                    {member.bio}
                  </p>
                </div>

                {/* Social Links Bar */}
                <div className="pt-5 border-t border-border-subtle flex justify-center items-center gap-3">
                  {linkedinUrl && (
                    <a
                      href={linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-9 h-9 rounded-xl bg-surface border border-border-subtle flex items-center justify-center text-foreground-secondary hover:text-action-primary hover:border-action-primary/50 hover:scale-105 transition-all shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus"
                      aria-label={`${member.name} LinkedIn Profile`}
                    >
                      <FontAwesomeIcon icon={faLinkedin} className="text-base" />
                    </a>
                  )}

                  {githubUrl && (
                    <a
                      href={githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-9 h-9 rounded-xl bg-surface border border-border-subtle flex items-center justify-center text-foreground-secondary hover:text-action-primary hover:border-action-primary/50 hover:scale-105 transition-all shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus"
                      aria-label={`${member.name} GitHub Profile`}
                    >
                      <FontAwesomeIcon icon={faGithub} className="text-base" />
                    </a>
                  )}

                  {twitterUrl && (
                    <a
                      href={twitterUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-9 h-9 rounded-xl bg-surface border border-border-subtle flex items-center justify-center text-foreground-secondary hover:text-action-primary hover:border-action-primary/50 hover:scale-105 transition-all shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus"
                      aria-label={`${member.name} Twitter Profile`}
                    >
                      <FontAwesomeIcon icon={faTwitter} className="text-base" />
                    </a>
                  )}

                  {emailAddr && (
                    <a
                      href={emailAddr.startsWith("mailto:") ? emailAddr : `mailto:${emailAddr}`}
                      className="w-9 h-9 rounded-xl bg-surface border border-border-subtle flex items-center justify-center text-foreground-secondary hover:text-action-primary hover:border-action-primary/50 hover:scale-105 transition-all shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus"
                      aria-label={`Send email to ${member.name}`}
                    >
                      <FontAwesomeIcon icon={faEnvelope} className="text-base" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default AboutUs3;