import { useContext, useEffect, useRef, useState } from 'react';
import Popup from 'reactjs-popup';
import { useLocation } from 'wouter';
import { ClientConfigContext } from '../state/config';
import { ProfileContext } from '../state/profile';
import { Helmet } from "react-helmet";
import { siteName } from '../utils/constants';
import { useTranslation } from "react-i18next";
import { buildLoginPath, HIDDEN_LOGIN_REDIRECT } from "../utils/auth-redirect";
import { type ThemeMode, setThemeMode } from "../utils/darkModeUtils";
function Footer() {
    const { t } = useTranslation()
    const [, setLocation] = useLocation()
    const profile = useContext(ProfileContext);
    const [modeState, setModeState] = useState<ThemeMode>('system');
    const [widgetPos, setWidgetPos] = useState<{ x: number; y: number } | null>(() => {
        try {
            const saved = localStorage.getItem("rin_theme_widget_pos");
            if (saved) return JSON.parse(saved);
        } catch {}
        return null;
    });

    const resetWidgetPos = (e: React.MouseEvent) => {
        e.stopPropagation();
        setWidgetPos(null);
        try {
            localStorage.removeItem("rin_theme_widget_pos");
        } catch {}
    };
    const config = useContext(ClientConfigContext);
    const footerHtml = config.get<string>('footer');
    const footerHtmlRef = useRef<HTMLDivElement | null>(null);
    const mountedScriptNodesRef = useRef<HTMLScriptElement[]>([]);
    const loginEnabled = config.getBoolean('login.enabled');
    const [doubleClickTimes, setDoubleClickTimes] = useState(0);
    useEffect(() => {
        const mode = localStorage.getItem('theme') as ThemeMode || 'system';
        setModeState(mode);
        setMode(mode);
    }, [])

    useEffect(() => {
        const container = footerHtmlRef.current;
        if (!container) {
            return;
        }

        mountedScriptNodesRef.current.forEach((script) => script.remove());
        mountedScriptNodesRef.current = [];
        container.replaceChildren();

        if (!footerHtml) {
            return;
        }

        const template = document.createElement('template');
        template.innerHTML = footerHtml;

        const scripts = Array.from(template.content.querySelectorAll('script'));
        scripts.forEach((script) => script.remove());

        container.appendChild(template.content.cloneNode(true));

        scripts.forEach((script) => {
            const nextScript = document.createElement('script');

            Array.from(script.attributes).forEach((attribute) => {
                nextScript.setAttribute(attribute.name, attribute.value);
            });

            nextScript.textContent = script.textContent;
            container.appendChild(nextScript);
            mountedScriptNodesRef.current.push(nextScript);
        });

        return () => {
            mountedScriptNodesRef.current.forEach((script) => script.remove());
            mountedScriptNodesRef.current = [];
        };
    }, [footerHtml])

    const setMode = (mode: ThemeMode) => {
        setModeState(mode);
        setThemeMode(mode);
    };

    return (
        <footer>
            <Helmet>
                <link rel="alternate" type="application/rss+xml" title={siteName} href="/rss.xml" />
                <link rel="alternate" type="application/atom+xml" title={siteName} href="/atom.xml" />
                <link rel="alternate" type="application/json" title={siteName} href="/rss.json" />
            </Helmet>
            <div className="flex flex-col mb-8 space-y-2 justify-center items-center t-primary ani-show">
                <div ref={footerHtmlRef} />
                <p className='text-sm text-neutral-500 font-normal link-line'>
                    <span onDoubleClick={() => {
                        if(doubleClickTimes >= 2){ // actually need 3 times doubleClick
                            setDoubleClickTimes(0)
                            if(!loginEnabled) {
                                setLocation(buildLoginPath(HIDDEN_LOGIN_REDIRECT))
                            }
                        } else {
                            setDoubleClickTimes(doubleClickTimes + 1)
                        }
                    }}>
                        © {new Date().getFullYear()} Powered by <a className='hover:underline' href="https://www.nodeseek.com/space/39375#/general" target="_blank">80hou</a>
                    </span>
                    {config.getBoolean('rss') && <>
                        <Spliter />
                        <Popup trigger={
                            <button className="hover:underline" type="button">
                                RSS
                            </button>
                        }
                            position="top center"
                            arrow={false}
                            closeOnDocumentClick>
                            <div className="border-card">
                                <p className='font-bold t-primary'>
                                    {t('footer.rss')}
                                </p>
                                <p>
                                    <a href='/rss.xml'>
                                        RSS
                                    </a> <Spliter />
                                    <a href='/atom.xml'>
                                        Atom
                                    </a> <Spliter />
                                    <a href='/rss.json'>
                                        JSON
                                    </a>
                                </p>

                            </div>
                        </Popup>
                    </>}
                </p>
                <div
                    style={widgetPos ? {
                        position: "fixed",
                        left: `${widgetPos.x}px`,
                        top: `${widgetPos.y}px`,
                        zIndex: 45,
                    } : undefined}
                    draggable={Boolean(profile?.permission)}
                    onDragEnd={(e) => {
                        if (!profile?.permission) return;
                        const x = Math.max(16, Math.min(window.innerWidth - 160, e.clientX - 60));
                        const y = Math.max(16, Math.min(window.innerHeight - 60, e.clientY - 20));
                        const next = { x, y };
                        setWidgetPos(next);
                        try {
                            localStorage.setItem("rin_theme_widget_pos", JSON.stringify(next));
                        } catch {}
                    }}
                    className={`w-fit-content inline-flex items-center gap-1 rounded-full border border-zinc-200 p-[3px] bg-w/80 backdrop-blur-md shadow-sm dark:border-zinc-700 transition-all select-none ${
                        profile?.permission ? "cursor-grab active:cursor-grabbing hover:border-theme" : ""
                    }`}
                    title={profile?.permission ? "管理员特权：按住可将日夜主题组件自由拖放到屏幕任意位置" : "切换浅色/跟随时间与系统/深色模式"}
                >
                    {profile?.permission && (
                        <span className="pl-1.5 pr-0.5 text-neutral-400 hover:text-theme text-xs">
                            <i className="ri-drag-move-2-line" />
                        </span>
                    )}
                    <ThemeButton mode='light' current={modeState} label="浅色日间模式" icon="ri-sun-line" onClick={setMode} />
                    <ThemeButton mode='system' current={modeState} label="智能自适应模式（18:00后自动夜间）" icon="ri-computer-line" onClick={setMode} />
                    <ThemeButton mode='dark' current={modeState} label="深色夜间模式" icon="ri-moon-line" onClick={setMode} />
                    {profile?.permission && widgetPos && (
                        <button
                            type="button"
                            onClick={resetWidgetPos}
                            title="恢复吸附在页脚默认位置"
                            className="pr-1.5 pl-0.5 text-[10px] text-neutral-400 hover:text-rose-500 font-mono transition"
                        >
                            <i className="ri-close-circle-line" />
                        </button>
                    )}
                </div>
            </div>
        </footer>
    );
}

function Spliter() {
    return (<span className='px-1'>
        |
    </span>
    )
}

function ThemeButton({ current, mode, label, icon, onClick }: { current: ThemeMode, label: string, mode: ThemeMode, icon: string, onClick: (mode: ThemeMode) => void }) {
    return (<button aria-label={label} type="button" onClick={() => onClick(mode)}
        className={`rounded-inherit inline-flex h-[32px] w-[32px] items-center justify-center border-0 t-primary ${current === mode ? "bg-w rounded-full shadow-xl shadow-light" : ""}`}>
        <i className={`${icon}`} />
    </button>)
}

export default Footer;
