import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

export interface TableOfContent {
    index: number
    text: string
    marginLeft: number
    element: HTMLElement
}

const getHeaderScrollOffset = () => {
    const rawValue = getComputedStyle(document.documentElement)
        .getPropertyValue('--header-scroll-offset')
        .trim()
    const offset = Number.parseFloat(rawValue)
    return Number.isFinite(offset) ? offset : 0
}

const useTableOfContents = (selector: string) => {
    const intersectingListRef = useRef<boolean[]>([]) // isIntersecting array
    const [tableOfContents, setTableOfContents] = useState<TableOfContent[]>([])
    const [activeIndex, setActiveIndex] = useState(0)
    const { t } = useTranslation()
    const io = useRef<IntersectionObserver | null>(null);
    const [ref, setRef] = useState("-1")
    const lastRef = useRef("")

    useEffect(() => {
        if (lastRef.current === ref) return
        const content = document.querySelector(selector)
        if (!content) return
        const intersectingList = intersectingListRef.current
        const headers = content.querySelectorAll<HTMLElement>(
            'h1, h2, h3, h4, h5, h6'
        ) // all headers

        // set TableOfContents
        const tocData = Array.from(headers).map<TableOfContent>((header, i) => ({
            index: i,
            text: header.textContent || '',
            marginLeft: (Number(header.tagName.charAt(1)) - 1) * 10,
            element: header, // have to down little bit
        }))
        setTableOfContents(tocData)

        // create IntersectionObserver
        if (io.current) io.current.disconnect()
        io.current = new IntersectionObserver(
            (entries) => {
                // save isIntersecting info to array using data-id
                entries.forEach(({ target, isIntersecting }) => {
                    const idx = Number((target as HTMLElement).dataset.id || 0)
                    intersectingList[idx] = isIntersecting
                })
                // get activeIndex
                const currentIndex = intersectingList.findIndex((item) => item)
                let activeIndex = currentIndex - 1
                if (currentIndex === -1) {
                    activeIndex = intersectingList.length - 1
                } else if (currentIndex === 0) {
                    activeIndex = 0
                }
                setActiveIndex(activeIndex)
            },
            { rootMargin: "-20% 0px 10000px 0px", threshold: 0 }
        )
        intersectingList.length = 0 // reset array
        headers.forEach((header, i) => {
            if (header.getAttribute('data-id') !== null) return
            header.setAttribute('data-id', i.toString()) // set data-id
            intersectingList.push(false) // increase array length
            io.current!.observe(header) // register to observe
        })
        lastRef.current = ref
        return () => {
            if (io.current) io.current.disconnect()
        }
    }, [ref])

    const cleanup = (newId: string) => {
        if (lastRef.current === newId) return
        setRef(newId)
        if (io.current) io.current.disconnect()
    }

    const tocStateRef = useRef({ tableOfContents, activeIndex, t })
    tocStateRef.current = { tableOfContents, activeIndex, t }

    const TOC = useCallback(() => {
        const { tableOfContents, activeIndex, t } = tocStateRef.current

        return (
            <div className='rounded-3xl bg-w p-5 border border-black/10 dark:border-white/10 shadow-sm backdrop-blur-md'>
                <div className="flex items-center justify-between pb-3 mb-2 border-b border-black/5 dark:border-white/5">
                    <span className="flex items-center gap-1.5 text-xs font-bold t-primary">
                        <i className="ri-compass-3-line text-theme text-sm" />
                        <span>画廊展厅导览</span>
                    </span>
                    <span className="text-[10px] text-neutral-400 font-mono">
                        {tableOfContents.length} 章节
                    </span>
                </div>
                <ul className="max-h-[calc(100vh-12rem)] overflow-y-auto space-y-1 text-xs" style={{ scrollbarWidth: "none" }}>
                    {tableOfContents.length === 0 && (
                        <li className="text-neutral-400 py-2 text-center text-xs">{t("index.empty.title")}</li>
                    )}
                    {tableOfContents.map((item) => {
                        const isActive = activeIndex === item.index;
                        return (
                            <li
                                key={`toc$${item.index}`}
                                onClick={() => {
                                    const top = item.element.getBoundingClientRect().top + window.scrollY - getHeaderScrollOffset() - 16;
                                    window.scrollTo({
                                        top: Math.max(top, 0),
                                        behavior: 'smooth'
                                    });
                                }}
                                className={`cursor-pointer transition-all duration-200 select-none block truncate ${
                                    isActive
                                        ? "bg-theme/10 text-theme font-bold rounded-xl px-3 py-1.5 border-l-2 border-theme shadow-2xs"
                                        : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 rounded-xl px-3 py-1.5"
                                }`}
                                style={{ paddingLeft: `${Math.max(12, item.marginLeft + 8)}px` }}
                                title={item.text}
                            >
                                {item.text}
                            </li>
                        );
                    })}
                </ul>
            </div>
        );
    }, [])

    return {
        TOC, cleanup
    }
}

export default useTableOfContents
