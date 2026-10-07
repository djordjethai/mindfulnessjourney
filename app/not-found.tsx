import Link from "next/link";

export default function NotFound(): React.JSX.Element {
  return <main className="not-found shell reading-width"><p className="eyebrow">404</p><h1>This path has gone quiet.</h1><p>The story may have moved, or the address may be incomplete.</p><Link className="button" href="/">Return home</Link></main>;
}
