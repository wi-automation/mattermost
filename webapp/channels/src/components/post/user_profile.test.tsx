// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {IntlProvider} from 'react-intl';

import type {Post} from '@mattermost/types/posts';

import UserProfile from 'components/user_profile';

import {render} from 'tests/react_testing_utils';

import PostUserProfile from './user_profile';

jest.mock('components/user_profile', () => ({
    __esModule: true,
    default: jest.fn(() => null),
}));

jest.mock('components/post_view/post_header_custom_status/post_header_custom_status', () => ({
    __esModule: true,
    default: () => null,
}));

describe('PostUserProfile bot labels', () => {
    const post = {
        id: 'post-id',
        user_id: 'user-id',
        channel_id: 'channel-id',
        props: {},
    } as Post;
    const userProfile = jest.mocked(UserProfile);

    beforeEach(() => {
        userProfile.mockClear();
    });

    test.each([
        {isBot: false, webhook: true},
        {isBot: true, webhook: false},
        {isBot: true, webhook: true},
    ])('hides message badges for %j in every layout', ({isBot, webhook}) => {
        for (const layout of [
            {},
            {compactDisplay: true},
            {isMobileView: true},
            {isConsecutivePost: true},
            {isSystemMessage: true},
        ]) {
            userProfile.mockClear();
            const {container, unmount} = render(
                <IntlProvider locale='en'>
                    <PostUserProfile
                        post={{...post, props: {from_webhook: String(webhook)}}}
                        isBot={isBot}
                        isSystemMessage={false}
                        isMobileView={false}
                        location='CENTER'
                        {...layout}
                    />
                </IntlProvider>,
            );

            expect(container.textContent).not.toContain('BOT');
            expect(userProfile).toHaveBeenCalled();
            expect(userProfile.mock.calls.every(([props]) => props.hideBotTag === true)).toBe(true);
            unmount();
        }
    });

    test('preserves the webhook sender name, icon, and underlying post', () => {
        const webhookPost = {
            ...post,
            props: {
                from_webhook: 'true',
                override_username: 'Anna Esposito',
                override_icon_url: 'https://example.com/anna.png',
            },
        };
        const original = JSON.stringify(webhookPost);
        render(
            <IntlProvider locale='en'>
                <PostUserProfile
                    post={webhookPost}
                    isBot={false}
                    isSystemMessage={false}
                    isMobileView={false}
                    enablePostUsernameOverride={true}
                    location='CENTER'
                />
            </IntlProvider>,
        );

        const profileProps = userProfile.mock.calls[0]?.[0];
        expect(profileProps?.overwriteName).toBe('Anna Esposito');
        expect(profileProps?.overwriteIcon).toBe('https://example.com/anna.png');
        expect(JSON.stringify(webhookPost)).toBe(original);
    });
});
