import { EmailLink, SocialLinks } from "@/components/SocialLinks";

export function ContactDetails(): React.JSX.Element {
  return (
    <section className="contact-details shell reading-width" aria-labelledby="contact-details-title">
      <div className="contact-card">
        <p className="eyebrow">Email</p>
        <h2 id="contact-details-title">Let’s stay in touch</h2>
        <p>For questions or a personal message, the simplest way to reach me is by email.</p>
        <EmailLink />
      </div>
      <div className="contact-socials">
        <p className="eyebrow">Elsewhere</p>
        <SocialLinks showLabels />
      </div>
    </section>
  );
}
