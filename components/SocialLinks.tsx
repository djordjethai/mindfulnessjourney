import { CONTACT_EMAIL, SOCIAL_LINKS, type SocialLink } from "@/lib/site";

function SocialIcon({ name }: { name: SocialLink["name"] }): React.JSX.Element {
  if (name === "Facebook") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.4 8.5V6.8c0-.8.5-1 1-1h2.5V2.1L14.5 2C11.1 2 10 4.1 10 6.4v2.1H7v4.1h3V22h4.4v-9.4h3.2l.5-4.1h-3.7Z" /></svg>;
  }
  if (name === "X") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.2 3h4.9l4.7 6.3L18.2 3h2.6l-6.8 8.1L21.6 21h-4.9l-5-6.7L6.1 21H3.5l7-8.5L3.2 3Zm3.6 1.9 10.8 14.2h1.3L8.1 4.9H6.8Z" /></svg>;
  }
  if (name === "Instagram") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path fillRule="evenodd" d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7Zm5 3.2a4.8 4.8 0 1 1 0 9.6 4.8 4.8 0 0 1 0-9.6Zm0 2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Zm5.1-3.5a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4Z" /></svg>;
  }
  if (name === "YouTube") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path fillRule="evenodd" d="M21.6 7.1a3 3 0 0 0-2.1-2.2C17.6 4.4 12 4.4 12 4.4s-5.6 0-7.5.5a3 3 0 0 0-2.1 2.2A31 31 0 0 0 2 12a31 31 0 0 0 .4 4.9 3 3 0 0 0 2.1 2.2c1.9.5 7.5.5 7.5.5s5.6 0 7.5-.5a3 3 0 0 0 2.1-2.2A31 31 0 0 0 22 12a31 31 0 0 0-.4-4.9ZM10 15.3V8.7l5.8 3.3-5.8 3.3Z" /></svg>;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.8 16.6c-1.8 1.3-4.4 2-6.6 2-3.1 0-5.9-1.1-8-3-.2-.2 0-.4.2-.3 2.3 1.3 5.1 2.1 8 2.1 2 0 4.1-.4 6.1-1.2.3-.1.6.2.3.4Zm.7-1c-.2-.3-1.5-.1-2.1-.1-.2 0-.2-.1 0-.3 1.1-.7 2.9-.5 3.1-.3.2.2-.1 2-.9 3-.1.1-.3.1-.2-.1.2-.6.4-1.9.1-2.2ZM12.3 13.3c-.9.7-2.1 1-3.1 1-1.8 0-3.2-1.1-3.2-3.2 0-1.7.9-2.8 2.2-3.4 1.1-.5 2.7-.6 3.9-.8v-.3c0-.6 0-1.2-.3-1.7-.3-.4-.8-.6-1.3-.6-.9 0-1.7.5-1.9 1.4 0 .2-.2.4-.4.4l-2-.2c-.2 0-.4-.2-.3-.5C6.3 3 8.5 2.3 10.6 2.3c1.1 0 2.5.3 3.4 1.1 1.1 1 1 2.4 1 3.9v3.5c0 1.1.5 1.5.9 2.1.1.2.2.4 0 .5l-1.5 1.3c-.2.2-.4.2-.6.1-.6-.5-1.1-1-1.5-1.5Zm-.2-4.6c-1.5 0-3.1.3-3.1 2.1 0 .9.5 1.5 1.3 1.5.6 0 1.1-.4 1.4-.9.4-.7.4-1.4.4-2.2v-.5Z" /></svg>;
}

export function SocialLinks({ showLabels = false }: { showLabels?: boolean }): React.JSX.Element {
  return (
    <div className={`social-links${showLabels ? " social-links-labeled" : ""}`} aria-label="George M. Posi online">
      {SOCIAL_LINKS.map((link) => (
        <a href={link.href} key={link.name} target="_blank" rel="noreferrer" aria-label={`${link.name} — opens in a new tab`}>
          <SocialIcon name={link.name} />
          {showLabels ? <span>{link.name}</span> : null}
        </a>
      ))}
    </div>
  );
}

export function EmailLink({ showIcon = true }: { showIcon?: boolean }): React.JSX.Element {
  return (
    <a className="email-link" href={`mailto:${CONTACT_EMAIL}`}>
      {showIcon ? <svg viewBox="0 0 24 24" aria-hidden="true"><path fillRule="evenodd" d="M3 4h18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm0 2v.3l9 6.2 9-6.2V6H3Zm18 12V8.7l-8.4 5.8a1 1 0 0 1-1.2 0L3 8.7V18h18Z" /></svg> : null}
      <span>{CONTACT_EMAIL}</span>
    </a>
  );
}
