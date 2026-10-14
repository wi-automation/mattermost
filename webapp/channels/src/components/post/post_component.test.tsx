// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {PostPriority} from '@mattermost/types/posts';
import type {DeepPartial} from '@mattermost/types/utilities';

import {Posts} from 'mattermost-redux/constants';

import mergeObjects from 'packages/mattermost-redux/test/merge_objects';
import {act, fireEvent, renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import a11y from 'utils/a11y_controller_instance';
import {getHistory} from 'utils/browser_history';
import {Locations} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import PostComponent from './post_component';
import type {Props} from './post_component';

describe('PostComponent', () => {
    const currentTeam = TestHelper.getTeamMock();
    const channel = TestHelper.getChannelMock({team_id: currentTeam.id});

    const baseProps: Props = {
        center: false,
        currentTeam,
        currentUserId: 'currentUserId',
        displayName: '',
        hasReplies: false,
        isBot: false,
        isCollapsedThreadsEnabled: true,
        isFlagged: false,
        isMobileView: false,
        isPostAcknowledgementsEnabled: false,
        isPostPriorityEnabled: false,
        location: Locations.CENTER,
        post: TestHelper.getPostMock({channel_id: channel.id}),
        recentEmojis: [],
        replyCount: 0,
        team: currentTeam,
        pluginActions: [],
        actions: {
            markPostAsUnread: jest.fn(),
            emitShortcutReactToLastPostFrom: jest.fn(),
            selectPost: jest.fn(),
            selectPostFromRightHandSideSearch: jest.fn(),
            removePost: jest.fn(),
            closeRightHandSide: jest.fn(),
            selectPostCard: jest.fn(),
            setRhsExpanded: jest.fn(),
        },
    };

    describe('message actions toggle', () => {
        afterEach(async () => {
            await act(async () => a11y.cancelNavigation());
        });

        const props: Props = {
            ...baseProps,
            post: TestHelper.getPostMock({channel_id: channel.id, type: ''}),
        };

        test('reveals the existing actions only after clicking the corner button', async () => {
            renderWithContext(<PostComponent {...props}/>);

            const toggle = screen.getByRole('button', {name: 'Post extra options'});
            fireEvent.mouseOver(screen.getByTestId('postView'));
            expect(screen.queryByTestId(`post-menu-${props.post.id}`)).not.toBeInTheDocument();

            await act(async () => userEvent.click(toggle));
            expect(toggle).toHaveAttribute('aria-expanded', 'true');
            expect(screen.getByTestId(`post-menu-${props.post.id}`)).toBeInTheDocument();
            expect(screen.getByTestId(`PostDotMenu-Button-${props.post.id}`)).toBeInTheDocument();
            await waitFor(() => expect(screen.getByTestId(`post-menu-${props.post.id}`)).toHaveStyle({position: 'fixed'}));

            fireEvent.mouseLeave(screen.getByTestId('postView'));
            expect(toggle).toHaveAttribute('aria-expanded', 'true');
            await act(async () => userEvent.click(toggle));
            expect(toggle).toHaveAttribute('aria-expanded', 'false');
            expect(screen.queryByTestId(`post-menu-${props.post.id}`)).not.toBeInTheDocument();
        });

        test('closes on an outside click and restores focus on Escape', async () => {
            renderWithContext(<PostComponent {...props}/>);
            const toggle = screen.getByRole('button', {name: 'Post extra options'});

            await act(async () => userEvent.click(toggle));
            await act(async () => userEvent.click(document.body));
            expect(toggle).toHaveAttribute('aria-expanded', 'false');

            await act(async () => userEvent.click(toggle));
            await act(async () => screen.getByTestId(`PostDotMenu-Button-${props.post.id}`).focus());
            await act(async () => {
                fireEvent.keyDown(document.activeElement!, {key: 'Escape'});
            });
            expect(toggle).toHaveAttribute('aria-expanded', 'false');
            expect(toggle).toHaveFocus();
        });

        test('keeps the toolbar mounted while its extra-options menu is open', async () => {
            renderWithContext(<PostComponent {...props}/>);
            const toggle = screen.getByRole('button', {name: 'Post extra options'});
            userEvent.click(toggle);
            userEvent.click(screen.getByTestId(`PostDotMenu-Button-${props.post.id}`));

            const menu = await screen.findByRole('menu', {name: 'Post extra options'});
            fireEvent.mouseDown(menu);
            expect(toggle).toHaveAttribute('aria-expanded', 'true');
            expect(screen.getByTestId(`post-menu-${props.post.id}`)).toBeInTheDocument();
        });

        test('keeps the existing controls on mobile and in search results', () => {
            const {rerender} = renderWithContext(
                <PostComponent
                    {...props}
                    isMobileView={true}
                />,
            );
            expect(screen.queryByRole('button', {name: 'Post extra options'})).not.toBeInTheDocument();
            expect(screen.getByTestId(`PostDotMenu-Button-${props.post.id}`)).toBeInTheDocument();

            rerender(
                <PostComponent
                    {...props}
                    location={Locations.SEARCH}
                />,
            );
            expect(screen.queryByRole('button', {name: 'Post extra options'})).not.toBeInTheDocument();
            expect(screen.getByTestId(`PostDotMenu-Button-${props.post.id}`)).toBeInTheDocument();
        });
    });

    describe('reactions', () => {
        const baseState: DeepPartial<GlobalState> = {
            entities: {
                posts: {
                    reactions: {
                        [baseProps.post.id]: {
                            [`${baseProps.currentUserId}-taco`]: TestHelper.getReactionMock({emoji_name: 'taco'}),
                        },
                    },
                },
            },
        };

        test('should show reactions in the center channel', () => {
            renderWithContext(<PostComponent {...baseProps}/>, baseState);

            expect(screen.getByLabelText('reactions')).toBeInTheDocument();
        });

        test('should show reactions in thread view', () => {
            const state = mergeObjects(baseState, {
                views: {
                    rhs: {
                        selectedPostId: baseProps.post.id,
                    },
                },
            });

            let props: Props = {
                ...baseProps,
                location: Locations.RHS_ROOT,
            };
            const {rerender} = renderWithContext(<PostComponent {...props}/>, state);

            expect(screen.getByLabelText('reactions')).toBeInTheDocument();

            props = {
                ...baseProps,
                location: Locations.RHS_COMMENT,
            };
            rerender(<PostComponent {...props}/>);

            expect(screen.getByLabelText('reactions')).toBeInTheDocument();
        });

        test('should show only show reactions in search results with pinned/saved posts visible', () => {
            let props = {
                ...baseProps,
                location: Locations.SEARCH,
            };
            const {rerender} = renderWithContext(<PostComponent {...props}/>, baseState);

            expect(screen.queryByLabelText('reactions')).not.toBeInTheDocument();

            props = {
                ...baseProps,
                location: Locations.SEARCH,
                isPinnedPosts: true,
            };
            rerender(<PostComponent {...props}/>);

            expect(screen.getByLabelText('reactions')).toBeInTheDocument();

            props = {
                ...baseProps,
                location: Locations.SEARCH,
                isFlaggedPosts: true,
            };
            rerender(<PostComponent {...props}/>);

            expect(screen.getByLabelText('reactions')).toBeInTheDocument();
        });
    });

    describe('thread footer', () => {
        test('should never show thread footer for a post that isn\'t part of a thread', () => {
            let props: Props = baseProps;
            const {rerender} = renderWithContext(<PostComponent {...props}/>);

            expect(screen.queryByText(/Follow|Following/)).not.toBeInTheDocument();

            props = {
                ...baseProps,
                location: Locations.SEARCH,
            };
            rerender(<PostComponent {...props}/>);

            expect(screen.queryByText(/Follow|Following/)).not.toBeInTheDocument();
        });

        // This probably shouldn't appear in the search results https://mattermost.atlassian.net/browse/MM-53078
        test('should only show thread footer for a root post in the center channel and search results', () => {
            const rootPost = TestHelper.getPostMock({
                id: 'rootPost',
                channel_id: channel.id,
                reply_count: 1,
            });
            const state: DeepPartial<GlobalState> = {
                entities: {
                    posts: {
                        posts: {
                            rootPost,
                        },
                    },
                },
            };

            let props = {
                ...baseProps,
                hasReplies: true,
                post: rootPost,
                replyCount: 1,
            };
            const {rerender} = renderWithContext(<PostComponent {...props}/>, state);

            expect(screen.queryByText(/Follow|Following/)).toBeInTheDocument();

            props = {
                ...props,
                location: Locations.RHS_ROOT,
            };
            rerender(<PostComponent {...props}/>);

            expect(screen.queryByText(/Follow|Following/)).not.toBeInTheDocument();

            props = {
                ...props,
                location: Locations.SEARCH,
            };
            rerender(<PostComponent {...props}/>);

            expect(screen.queryByText(/Follow|Following/)).toBeInTheDocument();
        });

        test('should never show thread footer for a comment', () => {
            let props = {
                ...baseProps,
                hasReplies: true,
                post: {
                    ...baseProps.post,
                    root_id: 'some_other_post_id',
                },
            };
            const {rerender} = renderWithContext(<PostComponent {...props}/>);

            expect(screen.queryByText(/Follow|Following/)).not.toBeInTheDocument();

            props = {
                ...props,
                location: Locations.RHS_COMMENT,
            };
            rerender(<PostComponent {...props}/>);

            expect(screen.queryByText(/Follow|Following/)).not.toBeInTheDocument();

            props = {
                ...props,
                location: Locations.SEARCH,
            };
            rerender(<PostComponent {...props}/>);

            expect(screen.queryByText(/Follow|Following/)).not.toBeInTheDocument();
        });

        test('should not show thread footer with CRT disabled', () => {
            const rootPost = TestHelper.getPostMock({
                id: 'rootPost',
                channel_id: channel.id,
                reply_count: 1,
            });
            const state: DeepPartial<GlobalState> = {
                entities: {
                    posts: {
                        posts: {
                            rootPost,
                        },
                    },
                },
            };

            let props = {
                ...baseProps,
                hasReplies: true,
                isCollapsedThreadsEnabled: false,
                post: rootPost,
                replyCount: 1,
            };
            const {rerender} = renderWithContext(<PostComponent {...props}/>, state);

            expect(screen.queryByText(/Follow|Following/)).not.toBeInTheDocument();

            props = {
                ...props,
                location: Locations.SEARCH,
            };
            rerender(<PostComponent {...props}/>);

            expect(screen.queryByText(/Follow|Following/)).not.toBeInTheDocument();
        });

        describe('reply/X replies link', () => {
            const rootPost = TestHelper.getPostMock({
                id: 'rootPost',
                channel_id: channel.id,
                reply_count: 1,
            });
            const state: DeepPartial<GlobalState> = {
                entities: {
                    posts: {
                        posts: {
                            rootPost,
                        },
                    },
                },
            };

            const propsForRootPost = {
                ...baseProps,
                hasReplies: true,
                post: rootPost,
                replyCount: 1,
            };

            test('should select post in RHS when clicked in center channel', () => {
                renderWithContext(<PostComponent {...propsForRootPost}/>, state);

                userEvent.click(screen.getByText('1 reply'));

                // Yes, this action has a different name than the one you'd expect
                expect(propsForRootPost.actions.selectPostFromRightHandSideSearch).toHaveBeenCalledWith(rootPost);
            });

            test('should select post in RHS when clicked in center channel in a DM/GM', () => {
                const props = {
                    ...propsForRootPost,
                    team: undefined,
                };
                renderWithContext(<PostComponent {...props}/>, state);

                userEvent.click(screen.getByText('1 reply'));

                // Yes, this action has a different name than the one you'd expect
                expect(propsForRootPost.actions.selectPostFromRightHandSideSearch).toHaveBeenCalledWith(rootPost);
                expect(getHistory().push).not.toHaveBeenCalled();
            });

            test('should select post in RHS when clicked in a search result on the current team', () => {
                const props = {
                    ...propsForRootPost,
                    location: Locations.SEARCH,
                };
                renderWithContext(<PostComponent {...props}/>, state);

                userEvent.click(screen.getByText('1 reply'));

                expect(propsForRootPost.actions.selectPostFromRightHandSideSearch).toHaveBeenCalledWith(rootPost);
                expect(getHistory().push).not.toHaveBeenCalled();
            });

            test('should jump to post when clicked in a search result on another team', () => {
                const props = {
                    ...propsForRootPost,
                    location: Locations.SEARCH,
                    team: TestHelper.getTeamMock({id: 'another_team'}),
                };
                renderWithContext(<PostComponent {...props}/>, state);

                userEvent.click(screen.getByText('1 reply'));

                expect(propsForRootPost.actions.selectPostFromRightHandSideSearch).not.toHaveBeenCalled();
                expect(getHistory().push).toHaveBeenCalled();
            });
        });
    });

    describe('file list', () => {
        test('should show file list in post', () => {
            const fileInfo1 = TestHelper.getFileInfoMock({id: 'fileId1', name: 'file1.jpg'});
            const fileInfo2 = TestHelper.getFileInfoMock({id: 'fileId2', name: 'file2.jpg'});
            const fileInfo3 = TestHelper.getFileInfoMock({id: 'fileId3', name: 'file3.jpg'});

            const post = TestHelper.getPostMock({file_ids: [fileInfo1.id, fileInfo2.id, fileInfo3.id]});

            const state: DeepPartial<GlobalState> = {
                entities: {
                    posts: {
                        posts: {
                            [post.id]: post,
                        },
                    },
                    files: {
                        files: {
                            [fileInfo1.id]: fileInfo1,
                            [fileInfo2.id]: fileInfo2,
                            [fileInfo3.id]: fileInfo3,
                        },
                        fileIdsByPostId: {
                            [baseProps.post.id]: ['fileId1', 'fileId2', 'fileId3'],
                        },
                    },
                },
            };

            const props = {
                ...baseProps,
                post,
            };

            const {container} = renderWithContext(<PostComponent {...props}/>, state);
            expect(screen.getByTestId('fileAttachmentList')).toBeInTheDocument();
            expect(container.querySelectorAll('.post-image__column')).toHaveLength(3);
            expect(container.querySelectorAll('.post-image__column')[0]).toHaveTextContent(fileInfo1.name);
            expect(container.querySelectorAll('.post-image__column')[1]).toHaveTextContent(fileInfo2.name);
            expect(container.querySelectorAll('.post-image__column')[2]).toHaveTextContent(fileInfo3.name);
        });

        test('should show file list in edit container when editing', () => {
            const fileInfo1 = TestHelper.getFileInfoMock({id: 'fileId1', name: 'file1.jpg'});
            const fileInfo2 = TestHelper.getFileInfoMock({id: 'fileId2', name: 'file2.jpg'});
            const fileInfo3 = TestHelper.getFileInfoMock({id: 'fileId3', name: 'file3.jpg'});

            const team = TestHelper.getTeamMock({id: 'team_id'});
            const channel = TestHelper.getChannelMock({team_id: team.id});

            const post = TestHelper.getPostMock({
                file_ids: [fileInfo1.id, fileInfo2.id, fileInfo3.id],
                channel_id: channel.id,
                metadata: {
                    files: [fileInfo1, fileInfo2, fileInfo3],
                },
            });

            const state: DeepPartial<GlobalState> = {
                entities: {
                    posts: {
                        posts: {
                            [post.id]: post,
                        },
                    },
                    files: {
                        files: {
                            [fileInfo1.id]: fileInfo1,
                            [fileInfo2.id]: fileInfo2,
                            [fileInfo3.id]: fileInfo3,
                        },
                        fileIdsByPostId: {
                            [post.id]: [fileInfo1.id, fileInfo2.id, fileInfo3.id],
                        },
                    },
                    channels: {
                        channels: {
                            [channel.id]: channel,
                        },
                        roles: {
                            [channel.id]: new Set(['channel_member']),
                        },
                    },
                    teams: {
                        teams: {
                            [team.id]: team,
                        },
                    },
                    roles: {
                        roles: {
                            channel_member: {permissions: ['create_post']},
                        },
                    },
                },
                views: {
                    posts: {
                        editingPost: {
                            postId: post.id,
                            show: true,
                        },
                    },
                },
                storage: {
                    storage: {
                        edit_draft_id: {
                            value: {
                                ...post,
                            },
                        },
                    },
                },
            };

            const props = {
                ...baseProps,
                post,
                isPostBeingEdited: true,
            };

            const {container} = renderWithContext(<PostComponent {...props}/>, state);

            // advanced text editor should be visible
            expect(container.querySelector('.AdvancedTextEditor__body')).toBeInTheDocument();

            // file attachment list should be visible inside advanced text editor
            expect(container.querySelector('.AdvancedTextEditor__body .file-preview__container')).toBeInTheDocument();
            expect(container.querySelectorAll('.post-image__column')).toHaveLength(3);
            expect(container.querySelectorAll('.post-image__column')[0]).toHaveTextContent(fileInfo1.name);
            expect(container.querySelectorAll('.post-image__column')[1]).toHaveTextContent(fileInfo2.name);
            expect(container.querySelectorAll('.post-image__column')[2]).toHaveTextContent(fileInfo3.name);

            // additionally, files should not be visible outside the advanced text editor
            expect(screen.queryByTestId('fileAttachmentList')).not.toBeInTheDocument();
        });
    });

    describe('priority labels', () => {
        test('should show priority label for non-deleted post with priority metadata', () => {
            const post = TestHelper.getPostMock({
                metadata: {
                    priority: {
                        priority: PostPriority.URGENT,
                    },
                },
            });
            const props = {
                ...baseProps,
                post,
                isPostPriorityEnabled: true,
            };
            renderWithContext(<PostComponent {...props}/>);

            expect(screen.getByTestId('post-priority-label')).toBeInTheDocument();
        });

        test('should show priority label for non-deleted post with important priority metadata', () => {
            const post = TestHelper.getPostMock({
                metadata: {
                    priority: {
                        priority: PostPriority.IMPORTANT,
                    },
                },
            });
            const props = {
                ...baseProps,
                post,
                isPostPriorityEnabled: true,
            };
            renderWithContext(<PostComponent {...props}/>);

            expect(screen.getByTestId('post-priority-label')).toBeInTheDocument();
        });

        test('should not show priority label for deleted post with priority metadata', () => {
            const post = TestHelper.getPostMock({
                state: Posts.POST_DELETED as 'DELETED',
                metadata: {
                    priority: {
                        priority: PostPriority.URGENT,
                    },
                },
            });
            const props = {
                ...baseProps,
                post,
                isPostPriorityEnabled: true,
            };
            renderWithContext(<PostComponent {...props}/>);

            expect(screen.queryByTestId('post-priority-label')).not.toBeInTheDocument();
        });

        test('should not show priority label for deleted post with important priority metadata', () => {
            const post = TestHelper.getPostMock({
                state: Posts.POST_DELETED as 'DELETED',
                metadata: {
                    priority: {
                        priority: PostPriority.IMPORTANT,
                    },
                },
            });
            const props = {
                ...baseProps,
                post,
                isPostPriorityEnabled: true,
            };
            renderWithContext(<PostComponent {...props}/>);

            expect(screen.queryByTestId('post-priority-label')).not.toBeInTheDocument();
        });

        test('should not show priority label for post without priority metadata', () => {
            const post = TestHelper.getPostMock();
            const props = {
                ...baseProps,
                post,
                isPostPriorityEnabled: true,
            };
            renderWithContext(<PostComponent {...props}/>);

            expect(screen.queryByTestId('post-priority-label')).not.toBeInTheDocument();
        });
    });

    describe('chat bubbles', () => {
        test.each([
            {},
            {isConsecutivePost: true},
            {compactDisplay: true},
            {isMobileView: true, isConsecutivePost: true},
        ])('keeps the timestamp inside an own bubble for layout %j', (layout) => {
            const post = TestHelper.getPostMock({
                channel_id: channel.id,
                type: '',
                user_id: baseProps.currentUserId,
            });
            const {container} = renderWithContext(
                <PostComponent
                    {...baseProps}
                    post={post}
                    {...layout}
                />,
            );

            expect(container.querySelector('.post')).toHaveClass('post--bubble', 'post--bubble-own');
            expect(container.querySelector('.post__bubble .post__bubble-time .post__time')).toBeInTheDocument();
            expect(container.querySelector('.post__header .post__time')).not.toBeInTheDocument();
        });

        test.each([
            {isBot: false, postProps: {from_webhook: 'true'}},
            {isBot: true, postProps: {}},
        ])('keeps automated messages on the incoming side: %j', ({isBot, postProps}) => {
            const post = TestHelper.getPostMock({
                channel_id: channel.id,
                type: '',
                user_id: baseProps.currentUserId,
                props: postProps,
            });
            const {container} = renderWithContext(
                <PostComponent
                    {...baseProps}
                    post={post}
                    isBot={isBot}
                />,
            );

            expect(container.querySelector('.post')).toHaveClass('post--bubble');
            expect(container.querySelector('.post')).not.toHaveClass('post--bubble-own');
        });

        test.each([Locations.RHS_ROOT, Locations.RHS_COMMENT, Locations.SEARCH])('does not add bubbles to %s', (location) => {
            const post = TestHelper.getPostMock({channel_id: channel.id, type: ''});
            const {container} = renderWithContext(
                <PostComponent
                    {...baseProps}
                    post={post}
                    location={location}
                />,
            );

            expect(container.querySelector('.post')).not.toHaveClass('post--bubble');
            expect(container.querySelector('.post__bubble-time')).not.toBeInTheDocument();
        });
    });
});
