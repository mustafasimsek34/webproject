import React from 'react';
import { LoadingButton, Lozenge, SectionMessage, Stack, Text } from '@forge/react';
import { PageStatusResponse } from '../../shared/types';
import { t } from '../../shared/i18n';
import { formatLocalDateTime } from './format';

export interface ConfirmBlockProps {
	status: PageStatusResponse;
	loading: boolean;
	error?: boolean;
	pageChanged?: boolean;
	onConfirm: () => void;
	onReload?: () => void;
}

export function ConfirmBlock({ status, loading, error, pageChanged, onConfirm, onReload }: ConfirmBlockProps) {
	const confirmButton = (
		<LoadingButton appearance="primary" isLoading={loading} isDisabled={loading} onClick={onConfirm}>
			{t('confirmButton')}
		</LoadingButton>
	);

	if (pageChanged) {
		return (
			<SectionMessage appearance="information" title={t('pageChangedTitle')}>
				<Stack space="space.100">
					<Text>{t('pageChangedBody')}</Text>
					{onReload ? <LoadingButton onClick={onReload}>{t('reloadPage')}</LoadingButton> : null}
				</Stack>
			</SectionMessage>
		);
	}

	if (error) {
		return (
			<SectionMessage appearance="error" title={t('errorTitle')}>
				<Stack space="space.100">
					<Text>{t('errorBody')}</Text>
					{confirmButton}
				</Stack>
			</SectionMessage>
		);
	}

	if (status.status === 'confirmed') {
		return (
			<SectionMessage appearance="success" title={t('confirmed')}>
				<Text>{t('confirmedOn', { version: status.confirmedVersion ?? status.currentVersion, datetime: formatLocalDateTime(status.confirmedAt) })}</Text>
			</SectionMessage>
		);
	}

	if (status.status === 'expired') {
		return (
			<SectionMessage appearance="warning" title={t('expiredTitle')}>
				<Stack space="space.100">
					<Text>{t('expiredBody', { oldVersion: status.confirmedVersion ?? '—', newVersion: status.currentVersion })}</Text>
					{confirmButton}
				</Stack>
			</SectionMessage>
		);
	}

	const required = status.assignmentType === 'assigned';
	return (
		<SectionMessage appearance="information" title={required ? t('requiredTitle') : undefined}>
			<Stack space="space.100">
				<Text>{required ? t('requiredBody') : t('voluntaryBody')}</Text>
				{status.dueDate ? <Text>{t('dueLabel', { date: status.dueDate })}</Text> : null}
				{confirmButton}
			</Stack>
		</SectionMessage>
	);
}
