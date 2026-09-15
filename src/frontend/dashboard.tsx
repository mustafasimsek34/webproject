import React, { useEffect, useMemo, useState } from 'react';
import { view } from '@forge/bridge';
import ForgeReconciler, {
	Box,
	Button,
	DynamicTable,
	EmptyState,
	Heading,
	Inline,
	ProgressBar,
	SectionMessage,
	Select,
	Stack,
	Tab,
	TabList,
	TabPanel,
	Tabs,
	Text,
	Textfield,
	Tooltip,
	User
} from '@forge/react';
import { openExport } from './components/exportNavigation';
import { localeFromContext, setAppLocale, t, MessageKey } from '../shared/i18n';
import { ConfigModal } from './components/ConfigModal';
import { formatLocalDate } from './components/format';
import { useInvoke } from './components/useInvoke';
import { PageDetailItem, PageDetailResponse } from '../shared/types';

interface DashboardPage {
	pageId: string;
	title: string;
	spaceKey: string;
	assigned: number;
	confirmed: number;
	percent: number | null;
	deleted?: boolean;
	canView?: boolean;
	overdue?: boolean;
	dueDate?: string | null;
}

const pageSize = 10;
const detailTabs = ['outstanding', 'confirmed', 'voluntary', 'cannot-view', 'history'] as const;

export default function Dashboard() {
	const [rows, setRows] = useState<DashboardPage[]>([]);
	const [trackQuery, setTrackQuery] = useState('');
	const [hits, setHits] = useState<DashboardPage[]>([]);
	const [space, setSpace] = useState('all');
	const [status, setStatus] = useState('all');
	const [visibleCount, setVisibleCount] = useState(pageSize);
	const [selected, setSelected] = useState<DashboardPage>();
	const [configPage, setConfigPage] = useState<DashboardPage>();
	const dashboard = useInvoke<DashboardPage[], { pages: DashboardPage[] }>('getDashboard');
	const searchPages = useInvoke<DashboardPage[], { title: string }>('searchPages');
	const detail = useInvoke<PageDetailResponse, { data: { pageId: string } }>('getPageDetail');

	const refresh = () => void dashboard.run({ pages: [] }).then((result) => { if (result?.ok) setRows(result.data); });

	useEffect(() => {
		void view.getContext().then((context) => {
			setAppLocale(localeFromContext(context as { locale?: string; localId?: string }));
			refresh();
		});
	}, [dashboard.run]);

	useEffect(() => {
		const title = trackQuery.trim();
		if (!title) {
			setHits([]);
			return;
		}
		const timer = setTimeout(() => {
			void searchPages.run({ title }).then((result) => {
				if (result?.ok) setHits(result.data);
			});
		}, 250);
		return () => clearTimeout(timer);
	}, [searchPages.run, trackQuery]);

	const spaces = useMemo(() => [...new Set(rows.map((row) => row.spaceKey).filter(Boolean))], [rows]);
	const visibleRows = rows.filter((row) => {
		if (row.canView === false) return false;
		if (space !== 'all' && row.spaceKey !== space) return false;
		if (status === 'overdue' && !row.overdue) return false;
		if (status === 'complete' && row.percent !== 1) return false;
		if (status === 'incomplete' && (row.percent === 1 || row.percent === null)) return false;
		return true;
	});

	const openDetail = (row: DashboardPage) => {
		setSelected(row);
		void detail.run({ data: { pageId: row.pageId } });
	};

	if (dashboard.code === 'FORBIDDEN') {
		return <EmptyState header={t('forbiddenManager')} />;
	}

	if (selected) {
		const outstanding = detail.data?.items.filter((item) => item.status === 'outstanding' || item.status === 'expired').length ?? 0;
		return (
			<Stack space="space.200">
				<Button appearance="subtle" onClick={() => setSelected(undefined)}>{t('backToDashboard')}</Button>
				<Inline spread="space-between">
					<Stack space="space.050">
						<Heading size="medium">{detail.data?.title ?? selected.title}</Heading>
						<Text>
							{t('detailSummary', {
								confirmed: detail.data?.confirmed ?? selected.confirmed,
								assigned: detail.data?.assigned ?? selected.assigned,
								outstanding,
								cannotView: detail.data?.cannotView ?? 0
							})}
						</Text>
					</Stack>
					<Inline space="space.100">
						<Button onClick={() => setConfigPage(selected)}>{t('configure')}</Button>
						<Button onClick={() => void openExport({ pageId: selected.pageId })}>{t('export')}</Button>
						<Button isDisabled>{t('remind')} ({t('v11')})</Button>
					</Inline>
				</Inline>
				<Tabs id="detail-tabs">
					<TabList>{detailTabs.map((value) => <Tab key={value}>{t(`detail.${value}` as MessageKey)}</Tab>)}</TabList>
					{detailTabs.map((value) => (
						<TabPanel key={value}>
							<DetailPanel tab={value} detail={detail.data} loading={detail.loading} />
						</TabPanel>
					))}
				</Tabs>
				{configPage ? (
					<ConfigModal
						open
						pageId={configPage.pageId}
						spaceKey={configPage.spaceKey}
						onClose={() => setConfigPage(undefined)}
						onSaved={() => void detail.run({ data: { pageId: selected.pageId } })}
					/>
				) : null}
			</Stack>
		);
	}

	const head = {
		cells: [
			{ key: 'page', content: t('page') },
			{ key: 'space', content: t('space') },
			{ key: 'assigned', content: t('colAssigned') },
			{ key: 'confirmed', content: t('colConfirmed') },
			{ key: 'rate', content: t('colPercent') },
			{ key: 'due', content: t('colDue') }
		]
	};
	const tableRows = visibleRows.slice(0, visibleCount).map((row) => ({
		key: row.pageId,
		cells: [
			{
				key: 'page',
				content: (
					<Button appearance="subtle" onClick={() => openDetail(row)}>
						{row.deleted ? t('deletedPage', { id: row.pageId }) : row.title}
					</Button>
				)
			},
			{ key: 'space', content: row.spaceKey },
			{ key: 'assigned', content: row.assigned === 0 ? t('voluntaryDash') : String(row.assigned) },
			{ key: 'confirmed', content: String(row.confirmed) },
			{
				key: 'rate',
				content: row.deleted || row.percent === null
					? <Tooltip content={t('voluntaryTooltip')}><Text>{t('voluntaryDash')}</Text></Tooltip>
					: (
						<Inline space="space.100" alignBlock="center">
							<Text>{`${Math.round(row.percent * 100)}%`}</Text>
							<Box><ProgressBar value={row.percent} /></Box>
						</Inline>
					)
			},
			{ key: 'due', content: <Text>{row.overdue ? `⚠ ${formatLocalDate(row.dueDate)}` : formatLocalDate(row.dueDate)}</Text> }
		]
	}));

	return (
		<Stack space="space.200">
			<Inline spread="space-between">
				<Heading size="large">{t('dashboardTitle')}</Heading>
				<Button appearance="primary" onClick={() => void openExport({})}>{t('export')}</Button>
			</Inline>
			<Stack space="space.050">
				<Textfield id="track-search" value={trackQuery} onChange={(event) => setTrackQuery(event.target.value)} placeholder={t('trackSearchPlaceholder')} />
				{hits.length ? (
					<Stack space="space.050">
						{hits.map((hit) => (
							<Button
								key={hit.pageId}
								appearance="subtle"
								onClick={() => {
									setConfigPage(hit);
									setHits([]);
									setTrackQuery('');
								}}
							>
								{hit.title} ({hit.spaceKey})
							</Button>
						))}
					</Stack>
				) : null}
				<Text>{t('trackSearchHint')}</Text>
			</Stack>
			<Inline space="space.100">
				<Select
					value={{ label: space === 'all' ? t('allSpaces') : space, value: space }}
					options={[{ label: t('allSpaces'), value: 'all' }, ...spaces.map((value) => ({ label: value, value }))]}
					onChange={(value) => { if (value && !Array.isArray(value)) { setSpace(value.value); setVisibleCount(pageSize); } }}
				/>
				<Select
					value={{ label: t(`status.${status}` as MessageKey), value: status }}
					options={['all', 'incomplete', 'complete', 'overdue'].map((value) => ({ label: t(`status.${value}` as MessageKey), value }))}
					onChange={(value) => { if (value && !Array.isArray(value)) { setStatus(value.value); setVisibleCount(pageSize); } }}
				/>
			</Inline>
			{dashboard.error ? <SectionMessage appearance="error"><Text>{dashboard.error}</Text></SectionMessage> : null}
			{!dashboard.loading && !dashboard.error && visibleRows.length === 0 ? (
				<EmptyState header={t('noTrackedPages')} description={t('emptyDescription')} />
			) : (
				<Stack space="space.100">
					<DynamicTable head={head} rows={tableRows} isLoading={dashboard.loading} />
					{visibleCount < visibleRows.length ? <Button appearance="subtle" onClick={() => setVisibleCount((count) => count + pageSize)}>{t('loadMore')}</Button> : null}
				</Stack>
			)}
			{configPage ? (
				<ConfigModal
					open
					pageId={configPage.pageId}
					spaceKey={configPage.spaceKey}
					onClose={() => setConfigPage(undefined)}
					onSaved={() => { setConfigPage(undefined); refresh(); }}
				/>
			) : null}
		</Stack>
	);
}

function DetailPanel({ tab, detail, loading }: { tab: typeof detailTabs[number]; detail?: PageDetailResponse; loading: boolean }) {
	if (loading || !detail) return <Text>{t('loading')}</Text>;
	if (tab === 'cannot-view') {
		return (
			<Stack space="space.100">
				<SectionMessage appearance="warning"><Text>{t('cannotViewHint')}</Text></SectionMessage>
				<PeopleList items={detail.items.filter((item) => item.status === 'cannot-view')} />
			</Stack>
		);
	}
	if (tab === 'history') {
		return detail.history.length
			? <Stack space="space.100">{detail.history.map((entry) => <Text key={`${entry.actorId}-${entry.timestamp}`}>{`${entry.timestamp} · ${entry.actorId}`}</Text>)}</Stack>
			: <Text>{t('detailUnavailable')}</Text>;
	}
	const items = detail.items.filter((item) =>
		tab === 'outstanding' ? item.status === 'outstanding' || item.status === 'expired'
			: tab === 'confirmed' ? item.status === 'confirmed' && item.assignmentType === 'assigned'
				: item.assignmentType === 'voluntary'
	);
	return <PeopleList items={items} />;
}

function PeopleList({ items }: { items: PageDetailItem[] }) {
	if (!items.length) return <Text>{t('detailUnavailable')}</Text>;
	return (
		<Stack space="space.100">
			{items.map((item) => (
				<Inline key={`${item.accountId}-${item.assignmentType}`} spread="space-between">
					<Box>
						{item.deletedUser ? <Text>[deleted user]</Text> : <User accountId={item.accountId} />}
						<Text>
							{item.groupId ? t('assignedViaGroup', { group: item.groupId }) : item.assignmentType === 'assigned' ? t('assignedDirectly') : t('detail.voluntary')}
						</Text>
					</Box>
					<Text>{item.confirmedAt ?? item.status}</Text>
				</Inline>
			))}
		</Stack>
	);
}

ForgeReconciler.render(<Dashboard />);
