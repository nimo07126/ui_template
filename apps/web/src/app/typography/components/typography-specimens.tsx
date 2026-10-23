import { tokens } from "@template/design-tokens";
import { TypeSpecimenRow } from "./type-specimen-row";
import {
  toPixels,
  typeCategories,
  typeToken,
  weightLabels,
} from "./typography-data";

export function TypographySpecimens() {
  return (
    <div className="min-w-0">
      {typeCategories.map((category) => (
        <section
          aria-label={category.title}
          className="not-first:mt-8 max-[36rem]:not-first:mt-6"
          key={category.title}
        >
          <header className="flex items-end justify-between pb-3 border-b border-b-[var(--ds-color-line-strong)] gap-4 max-[36rem]:grid max-[36rem]:gap-1">
            <div>
              <h3 className="text-[var(--ds-color-ink)] text-[length:var(--type-size-lg)] font-[number:var(--type-weight-semibold)] tracking-[var(--type-tracking-tight)] m-0">
                {category.title}
              </h3>
              <p className="max-w-168 mt-1 mb-0 text-[var(--ds-color-muted)] text-[length:var(--type-size-xs)] leading-[var(--type-line-compact)] mx-0">
                {category.description}
              </p>
            </div>
            <span className="flex-none text-[var(--ds-color-muted)] text-[length:var(--type-size-xs)]">
              {category.specimens.length} 个规格
            </span>
          </header>
          {category.specimens.map((specimen) => (
            <TypeSpecimenRow
              key={specimen.size}
              size={specimen.size}
              name={specimen.name}
              token={typeToken("size", specimen.size)}
              params={[
                { label: "字族", value: "系统无衬线" },
                {
                  label: "字号",
                  value: toPixels(tokens.type.size[specimen.size]),
                },
                {
                  label: "行高",
                  value: toPixels(tokens.type.line[specimen.line]),
                },
                {
                  label: "字重",
                  value: `${tokens.type.weight[specimen.weight]} · ${weightLabels[specimen.weight]}`,
                },
                {
                  label: "字距",
                  value:
                    tokens.type.tracking[specimen.tracking] === "0"
                      ? "0px"
                      : tokens.type.tracking[specimen.tracking],
                },
              ]}
              sample={specimen.sample}
              sampleClassName={specimen.className}
            />
          ))}
        </section>
      ))}
    </div>
  );
}
