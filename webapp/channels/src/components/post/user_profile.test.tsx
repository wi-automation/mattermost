// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import type {Post} from '@mattermost/types/posts';

import UserProfile from 'components/user_profile';
import BotTag from 'components/widgets/tag/bot_tag';

import PostUserProfile from './user_profile';

describe('PostUserProfile bot labels', () => {
    const post = {
        id: 'post-id',
        user_id: 'user-id',
        channel_id: 'channel-id',
        props: {},
    } as Post;

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
            const wrapper = shallow(
                <PostUserProfile
                    post={{...post, props: {from_webhook: String(webhook)}}}
                    isBot={isBot}
                    isSystemMessage={false}
                    isMobileView={false}
                    {...layout}
                />,
            );

            expect(wrapper.find(BotTag)).toHaveLength(0);
            expect(wrapper.find(UserProfile)).toHaveLength(1);
            expect(wrapper.find(UserProfile).prop('hideBotTag')).toBe(true);
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
        const wrapper = shallow(
            <PostUserProfile
                post={webhookPost}
                isBot={false}
                isSystemMessage={false}
                isMobileView={false}
                enablePostUsernameOverride={true}
            />,
        );

        expect(wrapper.find(UserProfile).prop('overwriteName')).toBe('Anna Esposito');
        expect(wrapper.find(UserProfile).prop('overwriteIcon')).toBe('https://example.com/anna.png');
        expect(JSON.stringify(webhookPost)).toBe(original);
    });
});
