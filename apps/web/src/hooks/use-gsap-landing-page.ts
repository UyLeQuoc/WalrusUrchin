import { useEffect, useRef } from "react"

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)"

async function loadGsap() {
  const { gsap } = await import("gsap")
  return gsap
}

export function useGsapLandingPage() {
  const pageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const page = pageRef.current
    if (!page) {
      return undefined
    }

    const reduceMotion = window.matchMedia(REDUCED_MOTION_QUERY).matches
    if (reduceMotion) {
      return undefined
    }

    let isCancelled = false
    let cleanup: (() => void) | undefined

    void loadGsap().then((gsap) => {
      if (isCancelled || !page.isConnected) {
        return
      }

      const context = gsap.context(() => {
        const heroTimeline = gsap.timeline({
          defaults: { ease: "power3.out" },
        })

        heroTimeline
          .from("[data-gsap='hero-badge']", {
            autoAlpha: 0,
            duration: 0.45,
            y: 16,
          })
          .from(
            "[data-gsap='hero-letter']",
            {
              duration: 0.85,
              rotate: 3,
              stagger: 0.026,
              yPercent: 112,
            },
            "-=0.1"
          )
          .from(
            "[data-gsap='hero-copy']",
            {
              autoAlpha: 0,
              duration: 0.65,
              y: 24,
            },
            "-=0.42"
          )
          .from(
            "[data-gsap='hero-actions']",
            {
              autoAlpha: 0,
              duration: 0.55,
              y: 18,
            },
            "-=0.35"
          )
          .from(
            "[data-gsap='hero-stage']",
            {
              autoAlpha: 0,
              duration: 0.8,
              scale: 0.96,
              y: 28,
            },
            "-=0.65"
          )
          .from(
            "[data-gsap='urchin-spine']",
            {
              autoAlpha: 0,
              duration: 0.5,
              scale: 0.25,
              stagger: { each: 0.012, from: "center" },
              svgOrigin: "300 300",
            },
            "-=0.4"
          )

        gsap.to("[data-gsap='orbit-ring']", {
          duration: 26,
          ease: "none",
          repeat: -1,
          rotate: 360,
          svgOrigin: "300 300",
        })

        gsap.to("[data-gsap='urchin-shell']", {
          duration: 58,
          ease: "none",
          repeat: -1,
          rotate: -360,
          svgOrigin: "300 300",
        })

        gsap.to("[data-gsap='urchin-spine']", {
          duration: 1.35,
          ease: "sine.inOut",
          repeat: -1,
          scale: 0.9,
          stagger: { each: 0.025, from: "center" },
          svgOrigin: "300 300",
          yoyo: true,
        })

        gsap.to("[data-gsap='urchin-body']", {
          duration: 2.6,
          ease: "sine.inOut",
          repeat: -1,
          y: -10,
          yoyo: true,
        })

        gsap.to("[data-gsap='urchin-tusk']", {
          duration: 2.2,
          ease: "sine.inOut",
          repeat: -1,
          scaleY: 1.04,
          transformOrigin: "50% 0%",
          yoyo: true,
        })

        gsap.to("[data-gsap='urchin-whiskers']", {
          duration: 1.8,
          ease: "sine.inOut",
          repeat: -1,
          rotate: 1.5,
          svgOrigin: "300 330",
          yoyo: true,
        })

        gsap.to("[data-gsap='marquee-track']", {
          duration: 24,
          ease: "none",
          repeat: -1,
          xPercent: -50,
        })
      }, page)

      cleanup = () => {
        context.revert()
      }
    })

    return () => {
      isCancelled = true
      cleanup?.()
    }
  }, [])

  return pageRef
}
