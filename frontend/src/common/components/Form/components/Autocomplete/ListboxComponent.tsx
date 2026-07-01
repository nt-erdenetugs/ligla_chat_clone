import {
  Children,
  forwardRef,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type HTMLAttributes,
  type ReactElement,
} from 'react';

import { Box, List, CircularProgress } from '@mui/material';
import { Virtualizer, type VListHandle } from 'virtua';

import { CHAT_ROOM_ITEMS_PER_PAGE } from '~/common/constants';
import { useInfiniteQueryContext } from '~/context/InfiniteScrollContext';
import { isTruthy } from '~/utils';

type ListboxProps = HTMLAttributes<HTMLElement> & {
  isRefVirtualizer?: boolean;
  scrollDirection?: 'top' | 'bottom';
  shouldScrollToBottom?: boolean;
  setShouldScrollToBottom?: (value: boolean) => void;
  onScroll?: () => void;
};

const LOADER_HEIGHT = 60;

const Loader = () => <CircularProgress size={30} />;
const BottomEdge = () => <div />;

const loaderBoxStyles = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  height: LOADER_HEIGHT,
};

export const ListboxComponent = forwardRef<VListHandle, ListboxProps>((props, ref) => {
  const {
    children,
    role = 'listbox',
    scrollDirection = 'bottom',
    isRefVirtualizer = false,
    style,
    shouldScrollToBottom,
    setShouldScrollToBottom,
    onScroll,
    className,
    ...other
  } = props;

  const isTopScroll = scrollDirection === 'top';
  const isBottomScroll = !isTopScroll;

  const items = useMemo(() => Children.toArray(children) as ReactElement[], [children]);

  const { infiniteQueryResponse: { fetchMore, loading: isQueryLoading, fetchedAll, error } = {} } =
    useInfiniteQueryContext();

  const virtualizerRef = useRef<Nullable<VListHandle>>(null);
  const containerRef = useRef<Nullable<HTMLDivElement>>(null);

  const topLoaderRef = useRef<HTMLDivElement>(null);
  const bottomLoaderRef = useRef<HTMLDivElement>(null);
  const prevItemsCountRef = useRef<Nullable<number>>(items.length);
  const isFetchingMoreRef = useRef(false);
  const isScrollingRef = useRef(false);

  const hasLoaderElement = !fetchedAll;
  const lastItemIndex = items.length;
  const firstItemToKeepMounted = hasLoaderElement && isTopScroll ? 0 : null;
  const lastItemToKeepMounted = hasLoaderElement && isBottomScroll ? lastItemIndex : null;

  const keepMounted = useMemo(
    () => [firstItemToKeepMounted, lastItemToKeepMounted].filter((index) => isTruthy(index, true)),
    [firstItemToKeepMounted, lastItemToKeepMounted],
  );

  useEffect(() => {
    if (!isRefVirtualizer || !ref) return;

    if (typeof ref === 'function') return ref(virtualizerRef.current);
    ref.current = virtualizerRef.current;
  }, [isRefVirtualizer, ref]);

  useLayoutEffect(() => {
    const virtualizer = virtualizerRef.current;
    if (!virtualizer || isBottomScroll || !shouldScrollToBottom) return;

    const scrollAnimation = requestAnimationFrame(() => {
      virtualizer.scrollToIndex(lastItemIndex, { align: 'end' });
      setShouldScrollToBottom?.(false);
    });

    return () => cancelAnimationFrame(scrollAnimation);
  }, [isBottomScroll, setShouldScrollToBottom, shouldScrollToBottom, lastItemIndex]);

  const loadMoreItems = useCallback(async () => {
    if (isQueryLoading || fetchedAll || !fetchMore || error || (isTopScroll && items.length === 0))
      return;

    isFetchingMoreRef.current = true;
    prevItemsCountRef.current = items.length;

    try {
      await fetchMore();
    } catch (error) {
      console.error('[handleLoadMore] Failed to fetch more items:', error);
    } finally {
      isFetchingMoreRef.current = false;
    }
  }, [error, fetchMore, fetchedAll, isQueryLoading, isTopScroll, items.length]);

  useLayoutEffect(() => {
    const loaderEl = (isTopScroll ? topLoaderRef : bottomLoaderRef).current;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !isFetchingMoreRef.current) {
          loadMoreItems();
        }
      },
      {
        root: containerRef.current,
        rootMargin: '0px',
        // loader must be at least 50% visible
        threshold: 0.5,
      },
    );

    if (loaderEl) observer.observe(loaderEl);

    return () => {
      if (loaderEl) observer.unobserve(loaderEl);
      observer.disconnect();
    };
  }, [isTopScroll, loadMoreItems]);

  // NOTE: Restore scroll position after loading more at top
  useLayoutEffect(() => {
    const prevCount = prevItemsCountRef.current;
    const itemsAdded = prevCount !== null && items.length > prevCount;

    if (!virtualizerRef.current || isBottomScroll || !itemsAdded) {
      prevItemsCountRef.current = null;
      return;
    }

    const scrollRestorationElementIndex = items.length - prevCount + 1;
    virtualizerRef.current.scrollToIndex(scrollRestorationElementIndex, { align: 'start' });
    prevItemsCountRef.current = null;
  }, [items.length, isBottomScroll]);

  const isLoading = isQueryLoading || isFetchingMoreRef.current || isScrollingRef.current;

  const handleScroll = () => {
    if (onScroll) onScroll();
    isScrollingRef.current = true;
  };

  const handleScrollEnd = () => (isScrollingRef.current = false);
  const mergedClassName = ['chat-messages', className].filter(Boolean).join(' ');

  return (
    <List
      {...other}
      role={role}
      component='div'
      ref={containerRef}
      className={mergedClassName}
      sx={{
        ...style,
        overflow: 'auto',
        height: '100%',
        p: 0,
        m: 0,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 40,
      }}
    >
      <Virtualizer
        ref={virtualizerRef}
        overscan={CHAT_ROOM_ITEMS_PER_PAGE}
        keepMounted={keepMounted}
        onScroll={handleScroll}
        onScrollEnd={handleScrollEnd}
        scrollRef={containerRef}
      >
        {hasLoaderElement && isTopScroll && (
          <Box ref={topLoaderRef} sx={loaderBoxStyles}>
            {isLoading && <Loader />}
          </Box>
        )}

        {items.map((item) => (isValidElement(item) ? <Box key={item.key}>{item}</Box> : null))}

        {hasLoaderElement && isBottomScroll && (
          <Box ref={bottomLoaderRef} sx={loaderBoxStyles}>
            {isLoading && <Loader />}
          </Box>
        )}

        {isTopScroll && <BottomEdge />}
      </Virtualizer>
    </List>
  );
});

ListboxComponent.displayName = 'ListboxComponent';
