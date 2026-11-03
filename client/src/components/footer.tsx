import { useContext, useEffect, useRef, useState } from 'react';
import Popup from 'reactjs-popup';
import { useLocation } from 'wouter';
import { ClientConfigContext } from '../state/config';
import { Helmet } from "react-helmet";
import { siteName } from '../utils/constants';
import { useTranslation } from "react-i18next";
import { buildLoginPath, HIDDEN_LOGIN_REDIRECT } from "../utils/auth-redirect";
import { setThemeMode, useColorMode, type ThemeMode } from "../utils/darkModeUtils";

function Footer() {
    const { t } = useTranslation();
    const [, setLocation] = useLocation();
    const colorMode = useColorMode();

    // 像后台一样纯净单键即时切换日间与夜间，绝无跑偏消失
    const toggleTheme = () => {
        const next: ThemeMode = colorMode === 'dark' ? 'light' : 'dark';
        setThemeMode(next);
    };

    const config = useContext(ClientConfigContext);
    const footerHtml = config.get<string>('footer');
    const footerHtmlRef = useRef<HTMLDivElement | null>(null);
    const mountedScriptNodesRef = useRef<HTMLScriptElement[]>([]);
    const loginEnabled = config.getBoolean('login.enabled');
    const [doubleClickTimes, setDoubleClickTimes] = useState(0);

    useEffect(() => {
        const container = footerHtmlRef.current;
        if (!container) return;

        mountedScriptNodesRef.current.forEach((script) => script.remove());
        mountedScriptNodesRef.current = [];
        container.replaceChildren();

        if (!footerHtml) return;

        const template = document.createElement('template');
        template.innerHTML = footerHtml;

        const scripts = Array.from(template.content.querySelectorAll('script'));
        scripts.forEach((script) => script.remove());

        container.appendChild(template.content.cloneNode(true));

        scripts.forEach((script) => {
            const newScript = document.createElement('script');
            Array.from(script.attributes).forEach((attr) => {
                newScript.setAttribute(attr.name, attr.value);
            });
            newScript.textContent = script.textContent;
            container.appendChild(newScript);
            mountedScriptNodesRef.current.push(newScript);
        });

        return () => {
            mountedScriptNodesRef.current.forEach((script) => script.remove());
            mountedScriptNodesRef.current = [];
        };
    }, [footerHtml]);

    return (
        <footer className="w-full flex flex-col items-center justify-center pt-2 pb-6 text-center select-none overflow-hidden">
            <Helmet>
                <link rel="alternate" type="application/rss+xml" title={siteName} href="/rss.xml" />
                <link rel="alternate" type="application/atom+xml" title={siteName} href="/atom.xml" />
                <link rel="alternate" type="application/json" title={siteName} href="/rss.json" />
            </Helmet>
            <div className="flex flex-col mb-4 space-y-2 justify-center items-center t-primary ani-show">
                <div ref={footerHtmlRef} />
                <p className='text-xs text-neutral-500 font-normal link-line'>
                    <span onDoubleClick={() => {
                        if (doubleClickTimes >= 2) {
                            setDoubleClickTimes(0);
                            if (!loginEnabled) {
                                setLocation(buildLoginPath(HIDDEN_LOGIN_REDIRECT));
                            }
                        } else {
                            setDoubleClickTimes(doubleClickTimes + 1);
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

                {/* 像后台一样纯净灵动的单键日月模式切换按钮，稳稳吸附在页脚中央，绝不消失跑偏 */}
                <div className="w-fit-content inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 p-1 bg-w/95 backdrop-blur-xl shadow-xs transition-all select-none">
                    <button
                        type="button"
                        onClick={toggleTheme}
                        aria-label="切换浅色/暗黑模式"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/5 dark:bg-white/10 hover:scale-110 active:scale-95 transition-all text-sm shadow-2xs"
                        title={colorMode === 'dark' ? "当前: 暗黑夜间模式 (点击切换为浅色日间)" : "当前: 浅色日间模式 (点击切换为暗黑夜间)"}
                    >
                        <i className={colorMode === 'dark' ? "ri-moon-line text-sky-400 text-base" : "ri-sun-line text-amber-500 text-base"} />
                    </button>
                    <span className="text-[11px] font-mono pr-2 font-bold text-neutral-500 dark:text-neutral-400 select-none">
                        {colorMode === 'dark' ? "夜间" : "日间"}
                    </span>
                </div>
            </div>
        </footer>
    );
}

function Spliter() {
    return (
        <span className='px-1'>
            |
        </span>
    );
}

export default Footer;
