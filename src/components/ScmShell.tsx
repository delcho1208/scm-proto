import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { brandLogo, products, userAvatar, type Product } from "@/data/scm";
import { useSelectedProductKey, setSelectedProductKey } from "@/data/product-store";

export function Icon({
  name,
  className = "",
  filled = false,
}: {
  name: string;
  className?: string;
  filled?: boolean;
}) {
  return (
    <span className={`material-symbols-outlined ${filled ? "filled" : ""} ${className}`}>
      {name}
    </span>
  );
}

export function ScmShell({ children }: { children: (product: Product) => ReactNode }) {
  const productKey = useSelectedProductKey();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState("");
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const product = products.find((p) => p.key === productKey)!;
  const filteredProducts = products.filter(
    (p) => p.name.includes(search) || p.subtitle.includes(search),
  );

  const topNav = [
    { to: "/simulation", label: "시뮬레이션" },
    { to: "/data-integration", label: "데이터 통합" },
  ];

  return (
    <div className="scm-root text-body-md">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 z-50 flex h-screen w-[240px] flex-col border-r border-outline-variant bg-surface py-md">
        <div className="mb-xl px-md">
          <div className="flex items-center gap-xs">
            <img
              alt="Chong Kun Dang Logo"
              className="h-8 w-auto rounded-lg object-contain"
              src={brandLogo}
            />
            <div>
              <h1 className="font-display text-headline-sm font-bold text-on-surface">
                SCM Dashboard
              </h1>
              <p className="text-label-caps text-on-surface-variant">Logistics Intelligence</p>
            </div>
          </div>
        </div>

        <div className="mb-xs px-md">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/60">
            메인 메뉴
          </p>
        </div>
        <nav className="space-y-1">
          <Link
            to="/simulation"
            className={`mx-2 flex items-center gap-md rounded-lg px-md py-sm transition-transform active:scale-[0.98] ${
              pathname === "/simulation" || pathname === "/"
                ? "bg-primary-container font-bold text-on-primary-container"
                : "text-on-surface-variant hover:bg-surface-variant"
            }`}
          >
            <Icon name="dashboard" filled />
            <span className="text-label-caps">모니터링</span>
          </Link>
          <Link
            to="/data-integration"
            className={`mx-2 flex items-center gap-md rounded-lg px-md py-sm transition-transform active:scale-[0.98] ${
              pathname === "/data-integration"
                ? "bg-primary-container font-bold text-on-primary-container"
                : "text-on-surface-variant hover:bg-surface-variant"
            }`}
          >
            <Icon name="location_on" />
            <span className="text-label-caps">권역별 재고</span>
          </Link>
          <a
            className="mx-2 flex items-center gap-md rounded-lg px-md py-sm text-on-surface-variant transition-colors hover:bg-surface-variant"
            href="#"
          >
            <Icon name="analytics" />
            <span className="text-label-caps">운영 현황</span>
          </a>
        </nav>

        <div className="mt-auto space-y-1 border-t border-outline-variant px-md pt-md">
          <div className="px-md py-sm text-[10px] font-bold text-on-surface-variant">
            LG CNS x Chong Kun Dang
          </div>
          {[
            { icon: "settings", label: "설정" },
            { icon: "help", label: "지원" },
          ].map((item) => (
            <a
              key={item.label}
              className="flex items-center gap-md rounded-lg px-md py-sm text-on-surface-variant transition-colors hover:bg-surface-variant"
              href="#"
            >
              <Icon name={item.icon} />
              <span className="text-label-caps">{item.label}</span>
            </a>
          ))}
          <button className="mt-md w-full cursor-pointer rounded-lg bg-primary-container py-sm font-bold text-on-primary-container transition-opacity hover:opacity-90 active:scale-[0.98]">
            Export Report
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="ml-[240px] flex min-h-screen flex-1 flex-col">
        <header className="fixed right-0 top-0 z-40 flex h-16 w-[calc(100%-240px)] items-center justify-between border-b border-outline-variant bg-surface-container px-lg">
          <div className="flex items-center gap-xl">
            <h2 className="font-display text-headline-sm font-black uppercase tracking-tight text-scm-primary">
              Digital Twin SCM Portal
            </h2>
            <nav className="hidden items-center gap-lg lg:flex">
              {topNav.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`transition-colors hover:text-scm-primary ${
                    pathname === item.to
                      ? "font-bold text-scm-primary"
                      : "text-on-surface-variant"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              <div className="relative ml-4">
                <button
                  onClick={() => setDropdownOpen((v) => !v)}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-outline-variant bg-surface-container px-4 py-2.5 text-[14px] font-semibold text-on-surface shadow-sm transition-all hover:bg-surface-container-high active:scale-[0.98]"
                >
                  <Icon name={product.icon} className="text-[20px] text-scm-primary" />
                  <div className="flex items-center gap-2">
                    <span className="text-on-surface-variant">제품 선택:</span>
                    <span className="rounded-full bg-primary-container px-2.5 py-1 text-[12px] font-bold text-on-primary-container shadow-sm">
                      {product.name}
                    </span>
                  </div>
                  <Icon name="expand_more" className="ml-auto text-[20px] text-outline" />
                </button>
                {dropdownOpen && (
                  <div className="absolute left-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-xl border border-outline-variant bg-white shadow-xl">
                    <div className="border-b border-outline-variant bg-surface-container-lowest p-3">
                      <div className="relative">
                        <Icon
                          name="search"
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-outline"
                        />
                        <input
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          className="w-full rounded-lg border border-outline-variant bg-white py-2 pl-10 pr-3 text-sm outline-none transition-all focus:border-scm-primary focus:ring-2 focus:ring-scm-primary"
                          placeholder="의약품 검색..."
                          type="text"
                        />
                      </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto py-2">
                      {filteredProducts.map((p) => (
                        <button
                          key={p.key}
                          onClick={() => {
                            setProductKey(p.key);
                            setDropdownOpen(false);
                          }}
                          className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-primary-container/10 ${
                            p.key === productKey ? "bg-surface-container-low" : ""
                          }`}
                        >
                          <Icon name={p.icon} className="text-[20px] text-scm-primary" />
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-on-surface">{p.name}</span>
                            <span className="text-[10px] text-on-surface-variant">{p.subtitle}</span>
                          </div>
                          {p.key === productKey && (
                            <Icon name="check_circle" className="ml-auto text-[20px] text-scm-primary" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </nav>
          </div>
          <div className="flex items-center gap-md">
            <div className="flex items-center gap-xs text-on-surface-variant">
              <Icon name="schedule" />
              <span className="font-data text-data-sm">2025-07-15</span>
            </div>
            <button className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-variant">
              <Icon name="notifications" />
            </button>
            <button className="cursor-pointer rounded-lg bg-scm-primary px-md py-1.5 text-white transition-opacity hover:opacity-90 active:scale-95">
              Refresh Data
            </button>
            <div className="h-8 w-8 overflow-hidden rounded-full bg-outline-variant">
              <img className="h-full w-full object-cover" src={userAvatar} alt="User avatar" />
            </div>
          </div>
        </header>

        {children(product)}

        <footer className="fixed bottom-0 right-0 z-40 flex w-[calc(100%-240px)] items-center justify-between border-t border-outline-variant bg-surface-container-lowest px-lg py-xs">
          <p className="text-[10px] font-bold text-on-surface-variant">
            © 2025 SCM Logistics Intelligence. LG CNS x Chong Kun Dang Integrated System.
          </p>
          <div className="flex gap-lg">
            {["Privacy Policy", "Terms of Service", "API Documentation"].map((l) => (
              <a key={l} className="text-[10px] text-on-surface-variant hover:underline" href="#">
                {l}
              </a>
            ))}
          </div>
        </footer>
      </main>
    </div>
  );
}
