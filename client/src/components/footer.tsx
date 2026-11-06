import { useContext, useEffect, useRef, useState } from 'react';
import Popup from 'reactjs-popup';
import { useLocation } from 'wouter';
import { ClientConfigContext } from '../state/config';
import { Helmet } from "react-helmet";
import { siteName } from '../utils/constants';
import { useTranslation } from "react-i18next";
import { buildLoginPath, HIDDEN_LOGIN_REDIRECT } from "../utils/auth-redirect";

function Footer() {
    const { t } = useTranslation();
    const [, setLocation] = useLocation();

    const config = useContext(ClientConfigContext);
    const footerHtml = config.get<string>('footer');
    const footerHtmlRef = useRef<HTMLDivElement | null>(null);
    const mountedScriptNodesRef = useRef<HTMLScriptElement[]>([]);
    const loginEnabled = config.getBoolean('login.enabled');
    const [doubleClickTimes, setDoubleClickTimes] = useState(0);

    const byText = config.get<string>("footer.by_text") || "80hou";
    const byUrl = config.get<string>("footer.by_url") || "https://www.nodeseek.com/space/39375#/general";

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
                        © {new Date().getFullYear()} Powered by <a className='hover:underline text-theme font-medium' href={byUrl} target="_blank" rel="noreferrer">{byText}</a>
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
