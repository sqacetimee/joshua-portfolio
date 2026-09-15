import { Fragment } from 'react'

/* Text split into letters so they can fade in one after another as the site opens (see index.css).
   Words stay unbroken, and the parent element should carry the full text as its aria-label. */
export default function Letters({ text }) {
  let index = 0
  return (
    <span className="letters" aria-hidden="true">
      {text.split(' ').map((word, w) => (
        <Fragment key={w}>
          {w > 0 && ' '}
          <span className="word">
            {[...word].map((ch) => {
              const i = index++
              return <span key={i} className="letter" style={{ '--i': i }}>{ch}</span>
            })}
          </span>
        </Fragment>
      ))}
    </span>
  )
}
