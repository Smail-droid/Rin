import type { AdjacentFeed, AdjacentFeedResponse } from "@rin/api";
import {useEffect, useState} from "react";
import { client } from "../app/runtime";
import {timeago} from "../utils/timeago.ts";
import {Link} from "wouter";
import {useTranslation} from "react-i18next";

export function AdjacentSection({id, setError}: { id: string, setError: (error: string) => void }) {
    const [adjacentFeeds, setAdjacentFeeds] = useState<AdjacentFeedResponse>();

    useEffect(() => {
        client.feed
            .adjacent(id)
            .then(({data, error}) => {
                if (error) {
                    setError(error.value as string);
                } else if (data && typeof data !== "string") {
                    setAdjacentFeeds(data);
                }
            });
    }, [id, setError]);
    return (
        <div className="rounded-3xl bg-w m-2 grid grid-cols-1 sm:grid-cols-2 border border-black/5 dark:border-white/5 overflow-hidden shadow-xs">
            <AdjacentCard data={adjacentFeeds?.previousFeed} type="previous"/>
            <AdjacentCard data={adjacentFeeds?.nextFeed} type="next"/>
        </div>
    )
}

export function AdjacentCard({data, type}: { data: AdjacentFeed | null | undefined, type: "previous" | "next" }) {
    const isPrev = type === "previous";
    const direction = isPrev ? "text-start" : "text-end";
    const {t} = useTranslation();

    if (!data) {
        return (
            <div className={`w-full p-5 sm:p-6 duration-300 opacity-40 select-none ${direction}`}>
                <p className="text-xs text-neutral-400 font-bold uppercase tracking-wider flex items-center gap-1">
                    {isPrev && <i className="ri-arrow-left-line" />}
                    <span>{isPrev ? "前一幅展出" : "后一幅展出"}</span>
                    {!isPrev && <i className="ri-arrow-right-line ml-auto" />}
                </p>
                <p className="text-sm font-semibold t-primary mt-2">{t('no_more')}</p>
            </div>
        );
    }

    return (
        <Link
            href={`/feed/${data.id}`}
            className={`group w-full p-5 sm:p-6 transition-all duration-300 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] ${direction}`}
        >
            <p className={`text-xs text-neutral-400 font-bold uppercase tracking-wider flex items-center gap-1 group-hover:text-theme transition ${isPrev ? "justify-start" : "justify-end"}`}>
                {isPrev && <i className="ri-arrow-left-line transition-transform group-hover:-translate-x-1" />}
                <span>{isPrev ? "前一幅展出" : "后一幅展出"}</span>
                {!isPrev && <i className="ri-arrow-right-line transition-transform group-hover:translate-x-1" />}
            </p>
            <h3 className="mt-2 text-base font-extrabold t-primary group-hover:text-theme transition truncate">
                {data.title}
            </h3>
            <p className="text-[11px] text-neutral-400 mt-1">
                {data.createdAt === data.updatedAt ? timeago(data.createdAt) : t('feed_card.published$time', {time: timeago(data.createdAt)})}
            </p>
        </Link>
    );
}
