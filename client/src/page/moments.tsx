import { Modal } from "@rin/ui"
import { useContext, useEffect, useRef, useState } from "react"
import { Helmet } from 'react-helmet'
import { client } from "../app/runtime"

import { useSiteConfig } from "../hooks/useSiteConfig";
import { siteName } from "../utils/constants"
import { useTranslation } from "react-i18next"
import { ProfileContext } from "../state/profile"
import { tryInt } from "../utils/int"
import { Link, useSearch } from "wouter"
import { useAlert, useConfirm } from "../components/dialog"
import { MarkdownEditor } from "../components/markdown_editor"
import { Waiting } from "../components/loading"
import { MomentItem } from "../components/moment_item"

interface Moment {
    id: number;
    content: string;
    createdAt: Date;
    updatedAt: Date;
    user: {
        id: number;
        username: string;
        avatar: string;
    };
}

export function MomentsPage() {
    const [moments, setMoments] = useState<Moment[]>([])
    const [length, setLength] = useState(0)
    const [content, setContent] = useState("")
    const [loading, setLoading] = useState(false)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingMoment, setEditingMoment] = useState<Moment | null>(null)
    const query = new URLSearchParams(useSearch());
    const ref = useRef("")
    const { t } = useTranslation()
    const siteConfig = useSiteConfig();
    const profile = useContext(ProfileContext);
    const { showAlert, AlertUI } = useAlert()
    const { showConfirm, ConfirmUI } = useConfirm()
    
    const [currentPage, setCurrentPage] = useState(1)
    const [hasNextPage, setHasNextPage] = useState(false)
    const [loadingMore, setLoadingMore] = useState(false)
    
    const limit = tryInt(siteConfig.pageSize, query.get("limit"))
    
    function fetchMoments(page = 1, append = false) {
        if (loadingMore) return
        
        const isInitialLoad = page === 1 && !append
        if (isInitialLoad) {
            setLoading(true)
        } else {
            setLoadingMore(true)
        }
        
        client.moments.list({
            page: page,
            limit: limit
        }).then(({ data }) => {
            if (data) {
                const momentData = Array.isArray(data.data) ? data.data : [];
                setLength(momentData.length)
                setHasNextPage(data.hasNext)
                
                if (append) {
                    setMoments(prev => [...prev, ...momentData] as any)
                } else {
                    setMoments(momentData as any)
                }
                
                setCurrentPage(page)
            }
        }).finally(() => {
            if (isInitialLoad) {
                setLoading(false)
            } else {
                setLoadingMore(false)
            }
        })
    }
    
    function loadMore() {
        if (hasNextPage && !loadingMore) {
            fetchMoments(currentPage + 1, true)
        }
    }
    
    function handleSubmit() {
        if (!content.trim()) return
        
        setLoading(true)
        
        if (editingMoment) {
            client.moments.update(editingMoment.id, { content })
            .then(({ error }) => {
                if (error) {
                    showAlert(t('update.failed$message', { message: error.value }))
                } else {
                    setContent("")
                    setEditingMoment(null)
                    setIsModalOpen(false)
                    fetchMoments(1, false)
                    showAlert(t('update.success'))
                }
            }).finally(() => {
                setLoading(false)
            })
        } else {
            client.moments.create({ content })
            .then(({ error }) => {
                if (error) {
                    showAlert(t('publish.failed$message', { message: error.value }))
                } else {
                    setContent("")
                    setIsModalOpen(false)
                    fetchMoments(1, false)
                    showAlert(t('publish.success'))
                }
            }).finally(() => {
                setLoading(false)
            })
        }
    }
    
    function handleEdit(moment: Moment) {
        setEditingMoment(moment)
        setContent(moment.content)
        setIsModalOpen(true)
    }
    
    function handleDelete(id: number) {
        showConfirm(
            t("delete.title"),
            t("delete.confirm"),
            () => {
                client.moments.delete(id).then(({ error }) => {
                    if (error) {
                        showAlert(t('delete.failed$message', { message: error.value }))
                    } else {
                        fetchMoments(1, false)
                        showAlert(t('delete.success'))
                    }
                })
            }
        )
    }
    
    function openCreateModal() {
        setEditingMoment(null)
        setContent("")
        setIsModalOpen(true)
    }
    
    useEffect(() => {
        const key = `${limit}`
        if (ref.current === key) return
        fetchMoments(1, false)
        ref.current = key
    }, [limit])
    
    return (
        <>
            <Helmet>
                <title>{`${t('moments.title')} - ${siteConfig.name}`}</title>
                <meta property="og:site_name" content={siteName} />
                <meta property="og:title" content={t('moments.title')} />
                <meta property="og:image" content={siteConfig.avatar} />
                <meta property="og:type" content="article" />
                <meta property="og:url" content={document.URL} />
            </Helmet>
            <Waiting for={!loading}>
                <main className="w-full flex flex-col justify-center items-center mb-8 ani-show">
                    {/* WeChat Moments Header */}
                    <div className="wauto text-start py-4 mb-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-black/10 dark:border-white/10">
                            <div>
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-xs font-bold mb-2">
                                    <i className="ri-chat-smile-2-line" />
                                    <span>朋友圈 · 碎碎念日常</span>
                                </div>
                                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight t-primary">
                                    日常随想
                                </h1>
                                <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                                    共收录 {length} 条生活随想碎碎念
                                </p>
                            </div>

                            <div className="flex items-center gap-3 self-start sm:self-auto">
                                <Link
                                    href="/"
                                    className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold t-primary shadow-2xs transition hover:bg-neutral-50 dark:border-white/10 dark:bg-neutral-900"
                                >
                                    <i className="ri-arrow-left-line" />
                                    <span>返回画廊</span>
                                </Link>
                                {profile?.permission && (
                                    <button 
                                        onClick={openCreateModal}
                                        className="inline-flex items-center gap-1.5 rounded-full bg-theme px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:opacity-90 active:scale-95"
                                    >
                                        <i className="ri-camera-lens-line" />
                                        <span>发朋友圈</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    <div className="wauto">
                        {moments && moments.length > 0 ? (
                            <div className="space-y-6">
                                {moments.map((moment) => (
                                    <MomentItem 
                                        key={moment.id} 
                                        moment={moment} 
                                        onDelete={handleDelete}
                                        onEdit={handleEdit}
                                        canManage={profile?.permission || false}
                                    />
                                ))}
                            </div>
                        ) : null}
                        
                        <Waiting for={!loadingMore}>
                            <div className="py-4 text-center">
                                {!hasNextPage && moments && moments.length > 0 ? (
                                    <div className="text-gray-500 pt-6">{t('no_more')}</div>
                                ) : hasNextPage ? (
                                    <button
                                        onClick={loadMore}
                                        className="text-sm font-normal rounded-full px-4 py-2 text-white bg-theme"
                                    >
                                        {t('load_more')}
                                    </button>
                                ) : null}
                            </div>
                        </Waiting>
                    </div>
                </main>
            </Waiting>
            
            <Modal
                isOpen={isModalOpen}
                onRequestClose={() => setIsModalOpen(false)}
                contentLabel={editingMoment ? t('moments.edit') : t('moments.publish')}
                size="lg"
                panelClassName="p-5 sm:p-6"
            >
                <div className="w-full">
                    <h2 className="mb-4 text-xl font-bold tracking-[-0.02em] t-primary">
                        {editingMoment ? t('moments.edit') : t('moments.publish')}
                    </h2>
                    
                    <div className="bg-w rounded-2xl t-primary">
                        <MarkdownEditor 
                            content={content}
                            setContent={setContent}
                            height="300px"
                        />
                    </div>
                    
                    <div className="flex justify-end mt-4 space-x-2">
                        <button
                            onClick={() => setIsModalOpen(false)}
                            className="rounded-xl bg-secondary px-4 py-2 t-primary bg-button"
                        >
                            {t('cancel')}
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={loading || !content.trim()}
                            className="px-4 py-2 bg-theme text-white rounded-lg disabled:opacity-50"
                        >
                            {loading ? t('saving') : editingMoment ? t('update.title') : t('publish.title')}
                        </button>
                    </div>
                </div>
            </Modal>
            
            <AlertUI />
            <ConfirmUI />
        </>
    )
}
