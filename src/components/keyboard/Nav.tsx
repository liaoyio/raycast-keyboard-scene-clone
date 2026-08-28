import Image from "next/image";

const navigation = [
  { label: "Store", href: "https://www.raycast.com/store" },
  { label: "Pro", href: "https://www.raycast.com/pro" },
  { label: "AI", href: "https://www.raycast.com/ai" },
  { label: "iOS", href: "https://www.raycast.com/ios" },
  { label: "Windows", href: "https://www.raycast.com/windows" },
  { label: "Teams", href: "https://www.raycast.com/teams" },
  { label: "Enterprise", href: "https://www.raycast.com/enterprise" },
  { label: "Blog", href: "https://www.raycast.com/blog" },
  { label: "Pricing", href: "https://www.raycast.com/pricing" },
] as const;

export function Nav() {
  return (
    <header className="nav-shell">
      <nav className="navbar" aria-label="Primary navigation">
        <a className="brand" href="https://www.raycast.com/" aria-label="Raycast">
          <Image src="/assets/raycast-logo.svg" alt="Raycast" width={93} height={24} priority />
        </a>

        <div className="nav-links">
          {navigation.map(({ label, href }) => (
            <a key={label} href={href}>
              {label}
            </a>
          ))}
        </div>

        <div className="nav-actions">
          <a className="login-link" href="https://www.raycast.com/users/sign_in">
            Log in
          </a>
          <a className="download-button" href="https://www.raycast.com/download/mac">
            <Image src="/assets/apple.svg" alt="" aria-hidden="true" width={16} height={16} />
            Download
          </a>
        </div>

        <button className="menu-button" type="button" aria-label="Open navigation menu">
          <span />
          <span />
          <span />
        </button>
      </nav>
    </header>
  );
}
