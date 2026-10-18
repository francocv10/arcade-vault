"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { useAuth } from "./auth-provider";
import { useDialog } from "./use-dialog";

export function Nav() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  const isHome = pathname.startsWith("/home");
  const isLibrary =
    pathname.startsWith("/biblioteca") || pathname.startsWith("/juegos");
  const isHall = pathname.startsWith("/salon");
  const isAbout = pathname.startsWith("/about");
  const isAuth = pathname.startsWith("/acceso");
  const close = () => setOpen(false);
  const panelRef = useDialog<HTMLDivElement>(open, {
    onEscape: close,
    // Safari no da el foco a un botón al hacer clic: el foco se devuelve al hamburguesa de forma explícita.
    returnFocus: () => hamburgerRef.current,
  });

  return (
    <>
      <nav className="av-nav" aria-label="Principal">
        <Link href="/home" className="logo">
          <div className="logo-mark"></div>
          <div className="logo-text neon-cyan">
            ARCADE <span className="neon-magenta">VAULT</span>
          </div>
        </Link>
        <div className="links">
          <Link href="/home" className={isHome ? "active" : ""}>
            Inicio
          </Link>
          <Link href="/biblioteca" className={isLibrary ? "active" : ""}>
            Biblioteca
          </Link>
          <Link href="/salon" className={isHall ? "active" : ""}>
            Salón de la Fama
          </Link>
          <Link href="/about" className={isAbout ? "active" : ""}>
            Sobre nosotros
          </Link>
        </div>
        <div className="spacer"></div>
        <div className="coin-counter">
          <span className="coin"></span>
          <span>CRÉDITOS · 03</span>
        </div>
        {user ? (
          <button className="btn ghost auth-btn" onClick={logout}>
            {user.name} ▾
          </button>
        ) : (
          <Link href="/acceso" className="btn auth-btn">
            Iniciar Sesión
          </Link>
        )}
        <button
          ref={hamburgerRef}
          className="btn ghost hamburger"
          onClick={() => setOpen(true)}
          aria-label="Menú"
          aria-expanded={open}
          aria-controls="menu-movil"
        >
          ≡
        </button>
      </nav>

      <div
        className={"av-mobile-backdrop" + (open ? " open" : "")}
        onClick={close}
        aria-hidden="true"
      ></div>
      <div
        id="menu-movil"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menú"
        inert={!open}
        className={"av-mobile-panel" + (open ? " open" : "")}
      >
        <div className="panel-head">
          <div className="pixel neon-cyan" style={{ fontSize: 11 }}>
            MENÚ
          </div>
          <button type="button" className="btn ghost" onClick={close}>
            CERRAR
          </button>
        </div>
        <Link href="/home" className={isHome ? "active" : ""} onClick={close}>
          Inicio
        </Link>
        <Link
          href="/biblioteca"
          className={isLibrary ? "active" : ""}
          onClick={close}
        >
          Biblioteca
        </Link>
        <Link href="/salon" className={isHall ? "active" : ""} onClick={close}>
          Salón de la Fama
        </Link>
        <Link href="/about" className={isAbout ? "active" : ""} onClick={close}>
          Sobre nosotros
        </Link>
        <Link href="/acceso" className={isAuth ? "active" : ""} onClick={close}>
          {user ? "Cuenta" : "Iniciar Sesión"}
        </Link>
        <div style={{ flex: 1 }}></div>
        <div
          className="pixel"
          style={{ fontSize: 9, color: "var(--ink-faint)", letterSpacing: "0.16em" }}
        >
          CRÉDITOS · 03
        </div>
      </div>
    </>
  );
}
