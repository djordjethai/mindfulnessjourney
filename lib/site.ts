export const CONTACT_EMAIL = "info@georgemposi.com";

export type SocialLink = {
  name: "Facebook" | "X" | "Instagram" | "YouTube" | "Amazon";
  href: string;
};

export const SOCIAL_LINKS: SocialLink[] = [
  { name: "Facebook", href: "https://www.facebook.com/gmposi" },
  { name: "X", href: "https://twitter.com/george_posi" },
  { name: "Instagram", href: "https://www.instagram.com/georgemposi/" },
  { name: "YouTube", href: "https://www.youtube.com/channel/UCmffykN4Iq8TY_1yyUWdoeA" },
  { name: "Amazon", href: "https://www.amazon.com/George-M-Posi/e/B07MP6CB7C" },
];
