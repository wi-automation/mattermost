// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {autoUpdate, flip, offset, shift, useFloating} from '@floating-ui/react';
import classnames from 'classnames';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import type {ReactNode} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {DotsHorizontalIcon} from '@mattermost/compass-icons/components';
import type {Emoji} from '@mattermost/types/emojis';
import type {Post} from '@mattermost/types/posts';

import {Posts} from 'mattermost-redux/constants/index';
import {isPostEphemeral} from 'mattermost-redux/utils/post_utils';

import ActionsMenu from 'components/actions_menu';
import CommentIcon from 'components/common/comment_icon';
import {usePluginVisibilityInSharedChannel} from 'components/common/hooks/usePluginVisibilityInSharedChannel';
import DotMenu from 'components/dot_menu';
import PostFlagIcon from 'components/post_view/post_flag_icon';
import PostReaction from 'components/post_view/post_reaction';
import PostRecentReactions from 'components/post_view/post_recent_reactions';

import {Locations, Constants} from 'utils/constants';
import {isSystemMessage, fromAutoResponder} from 'utils/post_utils';

import type {PostActionComponent} from 'types/store/plugins';

type Props = {
    post: Post;
    teamId: string;
    isFlagged: boolean;
    removePost: (post: Post) => void;
    enableEmojiPicker?: boolean;
    isReadOnly?: boolean;
    channelIsArchived?: boolean;
    channelIsShared?: boolean;
    handleCommentClick?: (e: React.MouseEvent) => void;
    handleJumpClick?: (e: React.MouseEvent) => void;
    handleDropdownOpened?: (e: boolean) => void;
    collapsedThreadsEnabled?: boolean;
    shouldShowActionsMenu?: boolean;
    oneClickReactionsEnabled?: boolean;
    recentEmojis: Emoji[];
    isExpanded?: boolean;
    hover?: boolean;
    isMobileView: boolean;
    hasReplies?: boolean;
    isFirstReply?: boolean;
    canReply?: boolean;
    replyCount?: number;
    location: keyof typeof Locations;
    isLastPost?: boolean;
    shortcutReactToLastPostEmittedFrom?: string;
    isPostHeaderVisible?: boolean | null;
    isPostBeingEdited?: boolean;
    canDelete?: boolean;
    pluginActions: PostActionComponent[];
    actions: {
        emitShortcutReactToLastPostFrom: (emittedFrom: 'CENTER' | 'RHS_ROOT' | 'NO_WHERE') => void;
    };
};

const PostOptions = (props: Props): JSX.Element => {
    const {formatMessage} = useIntl();
    const [showToolbar, setShowToolbar] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showDotMenu, setShowDotMenu] = useState(false);
    const [showActionsMenu, setShowActionsMenu] = useState(false);
    const toolbarRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const nestedMenuOpen = showEmojiPicker || showDotMenu || showActionsMenu;
    const toolbarOpen = showToolbar || nestedMenuOpen;
    const wasToolbarOpen = useRef(false);
    const {handleDropdownOpened} = props;
    const {refs, floatingStyles} = useFloating({
        open: toolbarOpen,
        placement: 'top-end',
        strategy: 'fixed',
        middleware: [offset(4), flip(), shift({padding: 8})],
        whileElementsMounted: autoUpdate,
    });

    useEffect(() => {
        if (wasToolbarOpen.current !== toolbarOpen) {
            wasToolbarOpen.current = toolbarOpen;
            handleDropdownOpened?.(toolbarOpen);
        }
    }, [toolbarOpen, handleDropdownOpened]);

    useEffect(() => {
        if (!showToolbar || nestedMenuOpen) {
            return undefined;
        }

        const handleOutsideClick = (event: MouseEvent | FocusEvent) => {
            if (!toolbarRef.current?.contains(event.target as Node)) {
                setShowToolbar(false);
            }
        };
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                setShowToolbar(false);
                triggerRef.current?.focus();
            }
        };

        document.addEventListener('mousedown', handleOutsideClick);
        document.addEventListener('focusin', handleOutsideClick);
        document.addEventListener('keydown', handleEscape, true);
        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
            document.removeEventListener('focusin', handleOutsideClick);
            document.removeEventListener('keydown', handleEscape, true);
        };
    }, [showToolbar, nestedMenuOpen]);

    const toggleEmojiPicker = useCallback((show: boolean) => {
        setShowEmojiPicker(show);
    }, []);

    const lastEmittedFrom = useRef(props.shortcutReactToLastPostEmittedFrom);
    useEffect(() => {
        // Confirm that lastEmittedFrom actually changed to avoid toggling the emoji picker when another dependency
        // changes without the user pressing the hotkey again
        if (lastEmittedFrom.current === props.shortcutReactToLastPostEmittedFrom) {
            return;
        }

        lastEmittedFrom.current = props.shortcutReactToLastPostEmittedFrom;

        const locationToUse = props.location === 'RHS_COMMENT' ? Locations.RHS_ROOT : props.location;

        if (props.isLastPost &&
            (props.shortcutReactToLastPostEmittedFrom === locationToUse) &&
                props.isPostHeaderVisible) {
            props.actions.emitShortcutReactToLastPostFrom(Locations.NO_WHERE);
            toggleEmojiPicker(!showEmojiPicker);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.isLastPost, props.shortcutReactToLastPostEmittedFrom, props.location, props.isPostHeaderVisible, showEmojiPicker]);

    const {
        channelIsArchived,
        collapsedThreadsEnabled,
        isReadOnly,
        post,
        oneClickReactionsEnabled,
        isMobileView,
    } = props;

    const isEphemeral = isPostEphemeral(post);
    const systemMessage = isSystemMessage(post);
    const isFromAutoResponder = fromAutoResponder(post);

    function removePost() {
        props.removePost(props.post);
    }

    const handleDotMenuOpened = (open: boolean) => {
        setShowDotMenu(open);
    };

    const handleActionsMenuOpened = (open: boolean) => {
        setShowActionsMenu(open);
    };

    const isPostDeleted = post && post.state === Posts.POST_DELETED;
    const hoverLocal = props.hover || toolbarOpen;
    const useToolbarToggle = !isMobileView && !systemMessage;
    const showCommentIcon = isFromAutoResponder || (!systemMessage && (isMobileView ||
            hoverLocal || (!post.root_id && Boolean(props.hasReplies)) ||
            props.isFirstReply) && props.location === Locations.CENTER);
    const commentIconExtraClass = isMobileView ? '' : 'pull-right';

    let commentIcon;
    if (showCommentIcon) {
        commentIcon = (
            <li>
                <CommentIcon
                    handleCommentClick={props.handleCommentClick}
                    postId={post.id}
                    extraClass={commentIconExtraClass}
                    commentCount={props.collapsedThreadsEnabled ? 0 : props.replyCount}
                />
            </li>
        );
    }

    const showRecentlyUsedReactions = (!isMobileView && !isReadOnly && !isEphemeral && !post.failed && !systemMessage && !channelIsArchived && oneClickReactionsEnabled && props.enableEmojiPicker && hoverLocal);

    let showRecentReactions: ReactNode;
    if (showRecentlyUsedReactions) {
        const showMoreReactions = props.isExpanded ||
            props.location === 'CENTER' ||
            (document.getElementById('sidebar-right')?.getBoundingClientRect().width ?? 0) > Constants.SIDEBAR_MINIMUM_WIDTH;

        showRecentReactions = (
            <PostRecentReactions
                channelId={post.channel_id}
                postId={post.id}
                teamId={props.teamId}
                emojis={props.recentEmojis}
                size={showMoreReactions ? 3 : 1}
            />
        );
    }

    const showReactionIcon = !systemMessage && !isReadOnly && !isEphemeral && !post.failed && props.enableEmojiPicker && !channelIsArchived;
    let postReaction;
    if (showReactionIcon) {
        postReaction = (
            <li>
                <PostReaction
                    channelId={post.channel_id}
                    location={props.location}
                    postId={post.id}
                    teamId={props.teamId}
                    showEmojiPicker={showEmojiPicker}
                    setShowEmojiPicker={toggleEmojiPicker}
                />
            </li>
        );
    }

    let flagIcon: ReactNode = null;
    if (!isMobileView && (!isEphemeral && !post.failed && !systemMessage)) {
        flagIcon = (
            <li>
                <PostFlagIcon
                    location={props.location}
                    postId={post.id}
                    isFlagged={props.isFlagged}
                />
            </li>
        );
    }

    // Action menus
    const showActionsMenuIcon = props.shouldShowActionsMenu && (isMobileView || hoverLocal);
    const actionsMenu = showActionsMenuIcon && (
        <li>
            <ActionsMenu
                post={post}
                location={props.location}
                handleDropdownOpened={handleActionsMenuOpened}
                isMenuOpen={showActionsMenu}
            />
        </li>
    );

    let pluginItems: ReactNode = null;
    const pluginItemsVisible = usePluginVisibilityInSharedChannel(post.channel_id);

    if ((!isEphemeral && !post.failed && !systemMessage) && hoverLocal && pluginItemsVisible) {
        pluginItems = props.pluginActions?.
            map((item) => {
                if (item.component) {
                    const Component = item.component;
                    return (
                        <li key={item.id}>
                            <Component
                                post={props.post}
                            />
                        </li>
                    );
                }
                return null;
            }) || [];
    }

    const dotMenu = (
        <li>
            <DotMenu
                post={props.post}
                location={props.location}
                isFlagged={props.isFlagged}
                handleDropdownOpened={handleDotMenuOpened}
                handleCommentClick={props.handleCommentClick}
                handleAddReactionClick={toggleEmojiPicker}
                isReadOnly={isReadOnly || channelIsArchived}
                isMenuOpen={showDotMenu}
                enableEmojiPicker={props.enableEmojiPicker}
            />
        </li>
    );

    // Build post options
    let options: ReactNode;
    if (isEphemeral) {
        options = (
            <div className='col col__remove'>
                <button
                    className='post__remove theme color--link style--none'
                    onClick={removePost}
                >
                    {'×'}
                </button>
            </div>
        );
    } else if (isPostDeleted || (systemMessage && !props.canDelete)) {
        options = null;
    } else if (props.location === Locations.SEARCH) {
        const hasCRTFooter = props.collapsedThreadsEnabled && !post.root_id && (post.reply_count > 0 || post.is_following);
        options = (
            <ul className='col__controls post-menu'>
                {dotMenu}
                {flagIcon}
                {props.canReply && !hasCRTFooter &&
                <li>
                    <CommentIcon
                        location={props.location}
                        handleCommentClick={props.handleCommentClick}
                        commentCount={props.replyCount}
                        postId={post.id}
                        searchStyle={'search-item__comment'}
                        extraClass={props.replyCount ? 'icon--visible' : ''}
                    />
                </li>
                }
                <li>
                    <a
                        href='#'
                        onClick={props.handleJumpClick}
                        className='search-item__jump'
                    >
                        <FormattedMessage
                            id='search_item.jump'
                            defaultMessage='Jump'
                        />
                    </a>
                </li>
            </ul>
        );
    } else if (!props.isPostBeingEdited) {
        options = (
            <ul
                ref={useToolbarToggle ? refs.setFloating : undefined}
                style={useToolbarToggle ? {...floatingStyles, right: 'auto'} : undefined}
                id={useToolbarToggle ? `${props.location}_post-actions_${post.id}` : undefined}
                data-testid={`post-menu-${props.post.id}`}
                className={classnames('col post-menu', {'post-menu--position': !hoverLocal && showCommentIcon})}
            >
                {!collapsedThreadsEnabled && !showRecentlyUsedReactions && dotMenu}
                {showRecentReactions}
                {postReaction}
                {flagIcon}
                {pluginItems}
                {actionsMenu}
                {commentIcon}
                {(collapsedThreadsEnabled || showRecentlyUsedReactions) && dotMenu}
            </ul>
        );

        if (useToolbarToggle) {
            const label = formatMessage({id: 'post_info.menuAriaLabel', defaultMessage: 'Post extra options'});
            options = (
                <div
                    className='post-actions'
                    ref={toolbarRef}
                >
                    <button
                        ref={(node) => {
                            triggerRef.current = node;
                            refs.setReference(node);
                        }}
                        type='button'
                        className='post-menu__item post-actions__toggle'
                        aria-label={label}
                        aria-expanded={toolbarOpen}
                        aria-controls={toolbarOpen ? `${props.location}_post-actions_${post.id}` : undefined}
                        onClick={(event) => {
                            event.stopPropagation();
                            setShowToolbar(!toolbarOpen);
                            setShowEmojiPicker(false);
                            setShowDotMenu(false);
                            setShowActionsMenu(false);
                        }}
                    >
                        <DotsHorizontalIcon size={16}/>
                    </button>
                    {toolbarOpen && options}
                </div>
            );
        }
    }

    return <>{options}</>;
};

export default PostOptions;
