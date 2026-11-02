import type { ReactNode } from "react";
import { lazy, Suspense, useContext } from "react";
import type { DefaultParams, PathPattern } from "wouter";
import { Route, Switch } from "wouter";
import { AdminLayout } from "../components/admin-layout";
import Footer from "../components/footer";
import { Header } from "../components/header";
import { Padding } from "../components/padding";
import { getHeaderLayoutDefinition } from "../components/site-header/layout-registry";
import { Tips, TipsPage } from "../components/tips";
import { TOCHeader } from "../components/toc-header";
import useTableOfContents from "../hooks/useTableOfContents";
import { useSiteConfig } from "../hooks/useSiteConfig";
import { ErrorPage } from "../page/error";
import { ProfileContext } from "../state/profile";
import { tryInt } from "../utils/int";
import { useTranslation } from "react-i18next";

// Route-level code splitting & lazy loading
const FeedsPage = lazy(() => import("../page/feeds").then((m) => ({ default: m.FeedsPage })));
const TimelinePage = lazy(() => import("../page/timeline").then((m) => ({ default: m.TimelinePage })));
const MomentsPage = lazy(() => import("../page/moments").then((m) => ({ default: m.MomentsPage })));
const FriendsPage = lazy(() => import("../page/friends").then((m) => ({ default: m.FriendsPage })));
const HashtagsPage = lazy(() => import("../page/hashtags").then((m) => ({ default: m.HashtagsPage })));
const HashtagPage = lazy(() => import("../page/hashtag").then((m) => ({ default: m.HashtagPage })));
const SearchPage = lazy(() => import("../page/search").then((m) => ({ default: m.SearchPage })));
const FeedPage = lazy(() => import("../page/feed").then((m) => ({ default: m.FeedPage })));
const LoginPage = lazy(() => import("../page/login").then((m) => ({ default: m.LoginPage })));
const ProfilePage = lazy(() => import("../page/profile").then((m) => ({ default: m.ProfilePage })));
const CallbackPage = lazy(() => import("../page/callback").then((m) => ({ default: m.CallbackPage })));

// Admin routes lazy loading (monaco editor, charts & management utilities decoupled)
const Settings = lazy(() => import("../page/settings").then((m) => ({ default: m.Settings })));
const AdminTagsPage = lazy(() => import("../page/admin-tags").then((m) => ({ default: m.AdminTagsPage })));
const HealthPage = lazy(() => import("../page/health").then((m) => ({ default: m.HealthPage })));
const AdminAIPage = lazy(() => import("../page/admin-ai").then((m) => ({ default: m.AdminAIPage })));
const QueueStatusPage = lazy(() => import("../page/queue-status").then((m) => ({ default: m.QueueStatusPage })));
const CompatTasksPage = lazy(() => import("../page/compat-tasks").then((m) => ({ default: m.CompatTasksPage })));
const WritingPage = lazy(() => import("../page/writing").then((m) => ({ default: m.WritingPage })));
const AdminFilesPage = lazy(() => import("../page/admin-files").then((m) => ({ default: m.AdminFilesPage })));
const AdminDashboardPage = lazy(() => import("../page/admin-dashboard").then((m) => ({ default: m.AdminDashboardPage })));
const AdminOpenListPage = lazy(() => import("../page/admin-openlist").then((m) => ({ default: m.AdminOpenListPage })));
const AdminTokensPage = lazy(() => import("../page/admin-tokens").then((m) => ({ default: m.AdminTokensPage })));
const AdminAccessPage = lazy(() => import("../page/admin-access").then((m) => ({ default: m.AdminAccessPage })));

function RouteLoadingFallback() {
  return (
    <div className="flex flex-col items-center justify-center py-24 ani-show min-h-[300px]" role="status" aria-label="Loading page">
      <i className="ri-loader-4-line animate-spin text-3xl text-theme mb-3" />
    </div>
  );
}

export function AppRoutes() {
  const { t } = useTranslation();

  return (
    <Switch>
      <AppRoute path="/">
        <FeedsPage />
      </AppRoute>

      <AppRoute path="/timeline">
        <TimelinePage />
      </AppRoute>

      <AppRoute path="/moments">
        <MomentsPage />
      </AppRoute>

      <AppRoute path="/friends">
        <FriendsPage />
      </AppRoute>

      <AppRoute path="/hashtags">
        <HashtagsPage />
      </AppRoute>

      <AppRoute path="/hashtag/:name">
        {(params) => <HashtagPage name={params.name || ""} />}
      </AppRoute>

      <AppRoute path="/search/:keyword">
        {(params) => <SearchPage keyword={params.keyword || ""} />}
      </AppRoute>

      <AdminRoute path="/admin" requirePermission title="画廊概览" description="系统核心资产统计 · 边缘运行健康指标 · 常用业务快捷中枢">
        <AdminDashboardPage />
      </AdminRoute>

      <AdminRoute path="/admin/dashboard" requirePermission title="画廊概览" description="系统核心资产统计 · 边缘运行健康指标 · 常用业务快捷中枢">
        <AdminDashboardPage />
      </AdminRoute>

      <AdminRoute path="/admin/openlist" requirePermission title="资源列表" description="OpenList 边缘存储目录索引挂载 · 支持网盘聚合与前台按需展示">
        <AdminOpenListPage />
      </AdminRoute>

      <AdminRoute path="/admin/access" requirePermission title="访问权限" description="文章隐私与特定内容保护 · 一键加锁与授权验证">
        <AdminAccessPage />
      </AdminRoute>

      <AdminRoute path="/admin/tokens" requirePermission title="口令生成" description="场景化访问通行证工坊 · 单次即焚/限次查看/永久激活密钥">
        <AdminTokensPage />
      </AdminRoute>

      <AdminRoute path="/admin/settings" requirePermission title={t("settings.title")} description={t("admin.settings_description")}>
        <Settings />
      </AdminRoute>

      <AdminRoute path="/admin/tags" requirePermission title="标签分类管理" description="管理与重命名全站标签体系">
        <AdminTagsPage />
      </AdminRoute>

      <AdminRoute path="/admin/health" requirePermission title={t("health.title")} description={t("admin.health_description")}>
        <HealthPage />
      </AdminRoute>

      <AdminRoute path="/admin/ai" requirePermission title="AI 助手" description="配置大模型提供商与核心系统指令提示词">
        <AdminAIPage />
      </AdminRoute>

      <AdminRoute path="/admin/queue-status" requirePermission title="队列与任务监控" description="Cloudflare 边缘分布式队列总线 · 实时探针指标 · 异步任务调度与错误自愈治理">
        <QueueStatusPage />
      </AdminRoute>

      <AdminRoute path="/admin/compat-tasks" requirePermission title={t("compat_tasks.title")} description={t("admin.compat_tasks_description")}>
        <CompatTasksPage />
      </AdminRoute>

      <AdminRoute path="/admin/writing" requirePermission title={t("writing")} description={t("admin.writing_description")}>
        <WritingPage />
      </AdminRoute>

      <AdminRoute path="/admin/writing/:id" requirePermission title={t("writing")} description={t("admin.writing_description")}>
        {({ id }) => <WritingPage id={tryInt(0, id)} />}
      </AdminRoute>

      <AdminRoute path="/admin/files" requirePermission title={t("admin_files.title")} description={t("admin_files.description")}>
        <AdminFilesPage />
      </AdminRoute>

      <AppRoute path="/gallery" paddingClassName="mx-3 sm:mx-6">
        <AdminFilesPage readOnly />
      </AppRoute>

      <AppRoute path="/callback">
        <CallbackPage />
      </AppRoute>

      <AppRoute path="/login">
        <LoginPage />
      </AppRoute>

      <AppRoute path="/profile">
        <ProfilePage />
      </AppRoute>

      <TocRoute path="/feed/:id">
        {(params, toc, cleanup) => <FeedPage id={params.id || ""} TOC={toc} clean={cleanup} />}
      </TocRoute>

      <TocRoute path="/:alias">
        {(params, toc, cleanup) => <FeedPage id={params.alias || ""} TOC={toc} clean={cleanup} />}
      </TocRoute>

      <AppRoute path="/user/github">
        <TipsPage>
          <Tips value={t("error.api_url")} type="error" />
        </TipsPage>
      </AppRoute>

      <AppRoute path="/*/user/github">
        <TipsPage>
          <Tips value={t("error.api_url_slash")} type="error" />
        </TipsPage>
      </AppRoute>

      <AppRoute path="/user/github/callback">
        <TipsPage>
          <Tips value={t("error.github_callback")} type="error" />
        </TipsPage>
      </AppRoute>

      <AppRoute>
        <ErrorPage error={t("error.not_found")} />
      </AppRoute>
    </Switch>
  );
}

function AppRoute({
  path,
  children,
  headerComponent,
  paddingClassName,
  requirePermission,
}: {
  path?: PathPattern;
  children: ReactNode | ((params: DefaultParams) => ReactNode);
  headerComponent?: ReactNode;
  paddingClassName?: string;
  requirePermission?: boolean;
}) {
  const profile = useContext(ProfileContext);
  const siteConfig = useSiteConfig();
  const { t } = useTranslation();

  return (
    <Route path={path}>
      {(params) => {
        if (requirePermission && profile === undefined) {
          return (
            <div className="flex flex-col items-center justify-center py-24 ani-show">
              <i className="ri-loader-4-line animate-spin text-3xl text-theme mb-3" />
            </div>
          );
        }

        if (requirePermission && !profile?.permission) {
          return <ErrorPage error={t("error.permission_denied")} />;
        }

        const resolvedContent = typeof children === "function" ? children(params) : children;
        const layoutDefinition = getHeaderLayoutDefinition(siteConfig.headerLayout);

        return layoutDefinition.renderRouteShell({
          header: <Header>{headerComponent}</Header>,
          content: (
            <Padding className={paddingClassName}>
              <Suspense fallback={<RouteLoadingFallback />}>
                {resolvedContent}
              </Suspense>
            </Padding>
          ),
          footer: <Footer />,
          paddingClassName,
        });
      }}
    </Route>
  );
}

function AdminRoute({
  path,
  children,
  requirePermission,
  title,
  description,
}: {
  path: PathPattern;
  children: ReactNode | ((params: DefaultParams) => ReactNode);
  requirePermission?: boolean;
  title: string;
  description: string;
}) {
  const profile = useContext(ProfileContext);
  const { t } = useTranslation();
  return (
    <Route path={path}>
      {(params) => {
        // While checking authentication, show a clean loading spinner inside AdminLayout
        if (requirePermission && profile === undefined) {
          return (
            <AdminLayout title={title} description={description}>
              <div className="flex flex-col items-center justify-center py-24 ani-show">
                <i className="ri-loader-4-line animate-spin text-3xl text-theme mb-3" />
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  {t("loading") || "Loading..."}
                </p>
              </div>
            </AdminLayout>
          );
        }

        // If verified without permission, show permission denied
        if (requirePermission && !profile?.permission) {
          return <ErrorPage error={t("error.permission_denied")} />;
        }

        const resolvedContent = typeof children === "function" ? children(params) : children;
        return (
          <AdminLayout title={title} description={description}>
            <Suspense fallback={<RouteLoadingFallback />}>
              {resolvedContent}
            </Suspense>
          </AdminLayout>
        );
      }}
    </Route>
  );
}

function TocRoute({
  path,
  children,
}: {
  path: PathPattern;
  children: (params: DefaultParams, toc: () => JSX.Element, cleanup: (id: string) => void) => ReactNode;
}) {
  const { TOC, cleanup } = useTableOfContents(".toc-content");

  return (
    <AppRoute path={path} headerComponent={TOCHeader({ TOC })} paddingClassName="mx-4">
      {(params) => children(params, TOC, cleanup)}
    </AppRoute>
  );
}
