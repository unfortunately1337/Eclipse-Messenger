"use client";

import { useLanguage } from "@/components/LocaleProvider";
import { LEGAL_REVISION, legalDocuments, legalRevisionLabel } from "@/lib/legal-documents";

export function LegalDocuments() {
  const { locale } = useLanguage();

  return (
    <article className="space-y-6 text-left text-[12.5px] leading-relaxed text-zinc-300 select-text break-words" data-legal-revision={LEGAL_REVISION}>
      <p className="text-[11px] text-zinc-400"><time dateTime={LEGAL_REVISION}>{legalRevisionLabel[locale]}</time></p>
      {legalDocuments.map((document) => (
        <section key={document.title.en} className="space-y-4">
          <h2 className="text-[15px] font-semibold text-white">{document.title[locale]}</h2>
          {document.sections.map((section) => (
            <section key={section.title.en} className="space-y-2">
              <h3 className="text-[13px] font-semibold text-zinc-100">{section.title[locale]}</h3>
              {section.paragraphs.map((paragraph) => <p key={paragraph.en}>{paragraph[locale]}</p>)}
              {section.links && (
                <ul className="space-y-1.5">
                  {section.links.map((link) => (
                    <li key={link.href}>
                      <a href={link.href} target="_blank" rel="noopener noreferrer" className="text-zinc-100 underline decoration-zinc-500 underline-offset-4 transition-colors hover:decoration-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
                        {link.label[locale]}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </section>
      ))}
    </article>
  );
}
