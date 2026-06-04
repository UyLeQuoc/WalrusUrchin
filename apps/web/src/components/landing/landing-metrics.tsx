import { trustMetrics } from "@/data/landing-page"

export function LandingMetrics() {
  return (
    <section
      className="border-y border-border bg-primary text-primary-foreground"
      aria-label="Platform primitives"
    >
      <p className="sr-only">
        {trustMetrics
          .map((metric) => `${metric.value}: ${metric.label}`)
          .join(". ")}
      </p>
      <div className="overflow-hidden" aria-hidden="true">
        <div
          className="flex w-max min-w-full items-center py-4"
          data-gsap="marquee-track"
        >
          {[0, 1].map((copy) => (
            <div key={copy} className="flex shrink-0 items-center gap-8 pr-8">
              {trustMetrics.map((metric) => (
                <div
                  key={`${copy}-${metric.value}`}
                  className="flex min-w-max items-center gap-3 text-sm uppercase"
                >
                  <span className="text-xl leading-none font-black">
                    {metric.value}
                  </span>
                  <span className="max-w-72 text-primary-foreground/75">
                    {metric.label}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
