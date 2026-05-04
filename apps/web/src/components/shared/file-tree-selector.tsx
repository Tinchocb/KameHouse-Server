import { cn } from "@/components/ui/core/styling"
import { TextInput } from "@/components/ui/text-input"
import { useDebounce } from "@/hooks/use-debounce"
import React, { useCallback, useMemo, useRef, useState } from "react"
import { FcFolder } from "react-icons/fc"
import { FiChevronDown, FiChevronRight, FiFile, FiSearch } from "react-icons/fi"
import { MdVerified } from "react-icons/md"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useGetLocalFilesInfinite } from "@/api/hooks/localfiles.hooks"
import { Anime_LocalFile } from "@/api/generated/types"

const filterFilePreviews = (filePreviews: Anime_LocalFile[], searchTerm: string): Anime_LocalFile[] => {
    if (!searchTerm.trim()) {
        return filePreviews
    }

    const lowerSearchTerm = searchTerm.toLowerCase()
    return filePreviews.filter(filePreview => {
        const searchableText = [
            filePreview.name,
            filePreview.path,
        ].join(" ").toLowerCase()

        return searchableText.includes(lowerSearchTerm)
    })
}

export type FileTreeNode = {
    name: string
    type: "file" | "directory"
    path: string
    filePreview?: Anime_LocalFile
    children?: FileTreeNode[]
}

export const buildFileTree = (filePreviews: Anime_LocalFile[]): FileTreeNode => {
    const root: FileTreeNode = {
        name: "root",
        type: "directory",
        path: "",
        children: [],
    }

    const sortedPreviews = filePreviews.toSorted((a, b) => a.path.localeCompare(b.path))

    sortedPreviews.forEach(filePreview => {
        const pathParts = filePreview.path.split("/").filter((part: string) => part !== "")
        let currentNode = root

        pathParts.forEach((part: string, index: number) => {
            const isFile = index === pathParts.length - 1
            const currentPath = pathParts.slice(0, index + 1).join("/")

            let existingNode = currentNode.children?.find(child => child.name === part)

            if (!existingNode) {
                existingNode = {
                    name: part,
                    type: isFile ? "file" : "directory",
                    path: currentPath,
                    filePreview: isFile ? filePreview : undefined,
                    children: isFile ? undefined : [],
                }
                currentNode.children?.push(existingNode)
            }

            if (!isFile) {
                currentNode = existingNode
            }
        })
    })

    return root
}

type FlatNode = FileTreeNode & { level: number }

function flattenTree(node: FileTreeNode, expandedPaths: Set<string>, level = 0): FlatNode[] {
    const list: FlatNode[] = [];
    if (node.path !== "") { // Skip root
        list.push({ ...node, level });
    }
    
    if (node.path === "" || (node.type === "directory" && expandedPaths.has(node.path))) {
        if (node.children) {
            node.children.forEach(child => {
                list.push(...flattenTree(child, expandedPaths, node.path === "" ? 0 : level + 1));
            });
        }
    }
    return list;
}

export type FileTreeSelectorProps = {
    selectedValue: string | number
    onFileSelect: (value: string | number) => void
    getFileValue: (filePreview: Anime_LocalFile) => string | number
    hasLikelyMatch?: boolean
    hasOneLikelyMatch?: boolean
    likelyMatchRef?: React.Ref<HTMLDivElement>
}

// 3. Render Optimization: Extract individual file/folder row into a memoized component
interface FileTreeRowProps {
    node: FlatNode
    virtualRow: any // From tanstack virtual
    isSelected: boolean
    isLikelyMatch: boolean
    isOpen: boolean
    hasLikelyMatch?: boolean
    hasOneLikelyMatch?: boolean
    likelyMatchRef?: React.Ref<HTMLDivElement>
    onFileSelect: (value: string | number) => void
    getFileValue: (filePreview: Anime_LocalFile) => string | number
    toggleOpen: (path: string) => void
}

const FileTreeRow = React.memo(({ 
    node, 
    virtualRow, 
    isSelected, 
    isLikelyMatch, 
    isOpen, 
    hasLikelyMatch, 
    hasOneLikelyMatch, 
    likelyMatchRef, 
    onFileSelect, 
    getFileValue, 
    toggleOpen 
}: FileTreeRowProps) => {
    return (
        <div
            style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
                paddingLeft: `${node.level * 16 + 8}px`,
                paddingRight: "8px",
            }}
            className="flex items-center"
        >
            <div
                className={cn(
                    "flex items-center py-1.5 px-2 border border-transparent rounded-[--radius] w-full h-full",
                    node.type === "file" && "cursor-pointer",
                    node.type === "file" && !isSelected && "hover:bg-[--subtle]",
                    isSelected && "bg-white dark:bg-gray-950 border border-gray-400",
                    (hasLikelyMatch && !isSelected && !isLikelyMatch && node.type === "file") && "opacity-60",
                )}
                onClick={(e) => {
                    e.stopPropagation()
                    if (node.type === "file" && node.filePreview) {
                        onFileSelect(getFileValue(node.filePreview))
                    }
                    if (node.type === "directory") {
                        toggleOpen(node.path)
                    }
                }}
                ref={hasOneLikelyMatch && isLikelyMatch ? likelyMatchRef : undefined}
            >
                <div className="flex items-center">
                    {node.type === "directory" && (
                        <span className="mr-1 cursor-pointer">
                            {isOpen ? (
                                <FiChevronDown className="size-5" />
                            ) : (
                                <FiChevronRight className="size-5" />
                            )}
                        </span>
                    )}
                    {node.type === "directory" ? (
                        <FcFolder className="size-5 mr-2 text-[--white] cursor-pointer" />
                    ) : (
                        <FiFile className="size-5 mr-2 text-[--muted]" />
                    )}
                </div>

                <div className="flex flex-col flex-1 min-w-0 cursor-pointer justify-center">
                    {node.type === "file" && node.filePreview ? (
                        <>
                            <p className="mb-0.5 line-clamp-1 font-medium text-sm">
                                {node.filePreview.name || node.filePreview.path.split(/[\\/]/).pop()}
                            </p>
                            <p className="font-normal line-clamp-1 text-xs text-[--muted]">{node.filePreview.path}</p>
                        </>
                    ) : (
                        <span
                            className={cn(
                                "font-medium text-sm",
                                node.type === "directory" ? "text-[--white]" : "cursor-pointer",
                            )}
                        >
                            {node.name}
                        </span>
                    )}
                </div>
            </div>
        </div>
    )
})
FileTreeRow.displayName = "FileTreeRow"

export const FileTreeSelector: React.FC<FileTreeSelectorProps> = ({
    selectedValue,
    onFileSelect,
    getFileValue,
    hasLikelyMatch = false,
    hasOneLikelyMatch = false,
    likelyMatchRef,
}) => {
    const [searchTerm, setSearchTerm] = useState("")
    const debouncedSearchTerm = useDebounce(searchTerm, 300)
    const parentRef = useRef<HTMLDivElement>(null)

    const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())

    // 2. Consume useInfiniteQuery seamlessly
    const { data: infiniteData, fetchNextPage, hasNextPage, isFetchingNextPage } = useGetLocalFilesInfinite()
    
    const filePreviews = useMemo(() => {
        if (!infiniteData) return []
        return infiniteData.pages.flatMap(page => page.items)
    }, [infiniteData])

    const fileTree = useMemo(() => {
        const filtered = filterFilePreviews(filePreviews || [], debouncedSearchTerm)
        return buildFileTree(filtered)
    }, [filePreviews, debouncedSearchTerm])

    React.useEffect(() => {
        if (!fileTree.children) return;
        const initial = new Set<string>();
        fileTree.children.forEach(child => {
            if (child.type === "directory") {
                initial.add(child.path)
            }
        });
        setExpandedPaths(initial);
    }, [fileTree])

    const flatNodes = useMemo(() => flattenTree(fileTree, expandedPaths), [fileTree, expandedPaths])

    const toggleOpen = useCallback((path: string) => {
        setExpandedPaths(prev => {
            const next = new Set(prev)
            if (next.has(path)) next.delete(path)
            else next.add(path)
            return next
        })
    }, [])

    const virtualizer = useVirtualizer({
        count: flatNodes.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 52,
        overscan: 10,
    })

    const virtualItems = virtualizer.getVirtualItems()

    // 2. Detect when user scrolls near bottom and trigger fetchNextPage
    React.useEffect(() => {
        const lastItem = virtualItems[virtualItems.length - 1]
        if (!lastItem) return
        
        if (
            lastItem.index >= flatNodes.length - 1 &&
            hasNextPage &&
            !isFetchingNextPage
        ) {
            fetchNextPage()
        }
    }, [virtualItems, flatNodes.length, hasNextPage, isFetchingNextPage, fetchNextPage])

    if (!filePreviews || filePreviews.length === 0) {
        return null
    }

    return (
        <div className="flex flex-col gap-3 h-full">
            <TextInput
                value={searchTerm}
                onValueChange={setSearchTerm}
                placeholder="Search files..."
                className="focus:ring-0 active:ring-0 flex-shrink-0"
            />

            <div 
                ref={parentRef} 
                className="flex-1 overflow-auto rounded-md border border-white/5 bg-black/20"
                style={{ minHeight: "300px", maxHeight: "600px" }}
            >
                {flatNodes.length > 0 ? (
                    <div
                        style={{
                            height: `${virtualizer.getTotalSize()}px`,
                            width: "100%",
                            position: "relative",
                        }}
                    >
                        {virtualItems.map((virtualRow) => {
                            const node = flatNodes[virtualRow.index]
                            const isSelected = !!(node.type === "file" && node.filePreview && selectedValue === getFileValue(node.filePreview))
                            const isLikelyMatch = false // Obsolete since Anime_LocalFile doesn't have isLikely Match
                            const isOpen = expandedPaths.has(node.path)

                            return (
                                <FileTreeRow
                                    key={virtualRow.key}
                                    node={node}
                                    virtualRow={virtualRow}
                                    isSelected={isSelected}
                                    isLikelyMatch={isLikelyMatch}
                                    isOpen={isOpen}
                                    hasLikelyMatch={hasLikelyMatch}
                                    hasOneLikelyMatch={hasOneLikelyMatch}
                                    likelyMatchRef={likelyMatchRef}
                                    onFileSelect={onFileSelect}
                                    getFileValue={getFileValue}
                                    toggleOpen={toggleOpen}
                                />
                            )
                        })}
                    </div>
                ) : debouncedSearchTerm.trim() ? (
                    <div className="text-center py-8 text-[--muted]">
                        <FiSearch className="mx-auto mb-2 size-8 opacity-50" />
                        <p>No files found matching "{debouncedSearchTerm}"</p>
                    </div>
                ) : null}
            </div>
        </div>
    )
}

export type FileTreeMultiSelectorProps = {
    selectedIndices: number[]
    onSelectionChange: (indices: number[]) => void
    getFileValue: (filePreview: Anime_LocalFile) => number
}

// 3. Render Optimization: Memoize the multi-select row
interface FileTreeMultiRowProps {
    node: FlatNode
    virtualRow: any
    isOpen: boolean
    isFileSelected: boolean
    dirState: {
        isSelected: boolean
        isPartial: boolean
        directoryFileIndices: number[]
    }
    getFileValue: (filePreview: Anime_LocalFile) => number
    selectedIndices: number[]
    onSelectionChange: (indices: number[]) => void
    toggleOpen: (path: string) => void
}

const FileTreeMultiRow = React.memo(({
    node,
    virtualRow,
    isOpen,
    isFileSelected,
    dirState,
    getFileValue,
    selectedIndices,
    onSelectionChange,
    toggleOpen
}: FileTreeMultiRowProps) => {
    return (
        <div
            style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
                paddingLeft: `${node.level * 16 + 8}px`,
                paddingRight: "8px",
            }}
            className="flex items-center"
        >
            <div
                className={cn(
                    "flex items-center py-1.5 px-2 border rounded-[--radius] cursor-pointer transition-colors w-full h-full",
                    node.type === "file" && isFileSelected && "border bg-gray-900 text-white",
                    node.type === "file" && !isFileSelected && "border-transparent",
                    node.type === "directory" && dirState.isSelected && "border bg-gray-900",
                    node.type === "directory" && dirState.isPartial && "bg-gray-900",
                    node.type === "directory" && !dirState.isSelected && !dirState.isPartial && "border-transparent",
                )}
                onClick={(e) => {
                    e.stopPropagation()
                    if (node.type === "file" && node.filePreview) {
                        const fileValue = getFileValue(node.filePreview)
                        if (!isFileSelected) {
                            onSelectionChange([...selectedIndices, fileValue])
                        } else {
                            onSelectionChange(selectedIndices.filter((idx: number) => idx !== fileValue))
                        }
                    } else if (node.type === "directory") {
                        if (dirState.isSelected) {
                            onSelectionChange(selectedIndices.filter((idx: number) => !dirState.directoryFileIndices.includes(idx)))
                        } else {
                            const newIndices = [...selectedIndices]
                            dirState.directoryFileIndices.forEach((idx: number) => {
                                if (!newIndices.includes(idx)) newIndices.push(idx)
                            })
                            onSelectionChange(newIndices)
                        }
                    }
                }}
            >
                <div className="flex items-center">
                    {node.type === "directory" && (
                        <span
                            className="mr-1 cursor-pointer p-1"
                            onClick={(e) => {
                                e.stopPropagation()
                                toggleOpen(node.path)
                            }}
                        >
                            {isOpen ? (
                                <FiChevronDown className="size-5" />
                            ) : (
                                <FiChevronRight className="size-5" />
                            )}
                        </span>
                    )}
                    {node.type === "directory" ? (
                        <FcFolder
                            className="size-5 mr-2 text-[--white] cursor-pointer"
                            onClick={(e) => {
                                e.stopPropagation()
                                toggleOpen(node.path)
                            }}
                        />
                    ) : (
                        <FiFile className="size-5 mr-2 text-[--muted]" />
                    )}
                </div>

                <div className="flex flex-col flex-1 min-w-0 justify-center">
                    {node.type === "file" && node.filePreview ? (
                        <>
                            <p className="mb-0.5 line-clamp-1 font-medium text-sm">
                                {node.filePreview.name || node.filePreview.path.split(/[\\/]/).pop()}
                            </p>
                            <p className="font-normal line-clamp-1 text-xs text-[--muted]">{node.filePreview.path}</p>
                        </>
                    ) : (
                        <span className="font-medium text-[--white] text-sm">
                            {node.name}
                        </span>
                    )}
                </div>

                <div className="ml-2 flex items-center pr-2">
                    {node.type === "file" && isFileSelected && (
                        <div className="w-2 h-2 bg-brand rounded-full" />
                    )}
                    {node.type === "directory" && dirState.isSelected && (
                        <div className="w-2 h-2 bg-brand rounded-full" />
                    )}
                    {node.type === "directory" && dirState.isPartial && (
                        <div className="w-2 h-2 bg-brand/60 rounded-full" />
                    )}
                </div>
            </div>
        </div>
    )
})
FileTreeMultiRow.displayName = "FileTreeMultiRow"

export const FileTreeMultiSelector: React.FC<FileTreeMultiSelectorProps> = ({
    selectedIndices,
    onSelectionChange,
    getFileValue,
}) => {
    const [searchTerm, setSearchTerm] = useState("")
    const debouncedSearchTerm = useDebounce(searchTerm, 300)
    const parentRef = useRef<HTMLDivElement>(null)

    const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())

    // 2. Consume useInfiniteQuery seamlessly
    const { data: infiniteData, fetchNextPage, hasNextPage, isFetchingNextPage } = useGetLocalFilesInfinite()
    
    const filePreviews = useMemo(() => {
        if (!infiniteData) return []
        return infiniteData.pages.flatMap(page => page.items)
    }, [infiniteData])

    const fileTree = useMemo(() => {
        const filtered = filterFilePreviews(filePreviews || [], debouncedSearchTerm)
        return buildFileTree(filtered)
    }, [filePreviews, debouncedSearchTerm])

    React.useEffect(() => {
        if (!fileTree.children) return;
        const initial = new Set<string>();
        fileTree.children.forEach(child => {
            if (child.type === "directory") {
                initial.add(child.path)
            }
        });
        setExpandedPaths(initial);
    }, [fileTree])

    const flatNodes = useMemo(() => flattenTree(fileTree, expandedPaths), [fileTree, expandedPaths])

    const toggleOpen = useCallback((path: string) => {
        setExpandedPaths(prev => {
            const next = new Set(prev)
            if (next.has(path)) next.delete(path)
            else next.add(path)
            return next
        })
    }, [])

    const getAllFileIndicesInDirectory = useCallback((n: FileTreeNode): number[] => {
        const indices: number[] = []
        if (n.type === "file" && n.filePreview) {
            indices.push(getFileValue(n.filePreview))
        } else if (n.children) {
            n.children.forEach(child => {
                indices.push(...getAllFileIndicesInDirectory(child))
            })
        }
        return indices
    }, [getFileValue])

    const getDirectorySelectionState = useCallback((node: FileTreeNode) => {
        const directoryFileIndices = getAllFileIndicesInDirectory(node)
        const selectedCount = directoryFileIndices.filter(idx => selectedIndices.includes(idx)).length

        return {
            isSelected: selectedCount === directoryFileIndices.length && directoryFileIndices.length > 0,
            isPartial: selectedCount > 0 && selectedCount < directoryFileIndices.length,
            directoryFileIndices
        }
    }, [getAllFileIndicesInDirectory, selectedIndices])

    const virtualizer = useVirtualizer({
        count: flatNodes.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 52, 
        overscan: 10,
    })

    const virtualItems = virtualizer.getVirtualItems()

    // 2. Detect when user scrolls near bottom and trigger fetchNextPage
    React.useEffect(() => {
        const lastItem = virtualItems[virtualItems.length - 1]
        if (!lastItem) return
        
        if (
            lastItem.index >= flatNodes.length - 1 &&
            hasNextPage &&
            !isFetchingNextPage
        ) {
            fetchNextPage()
        }
    }, [virtualItems, flatNodes.length, hasNextPage, isFetchingNextPage, fetchNextPage])

    if (!filePreviews || filePreviews.length === 0) {
        return null
    }

    return (
        <div className="flex flex-col gap-3 h-full">
            <TextInput
                value={searchTerm}
                onValueChange={setSearchTerm}
                placeholder="Search files..."
                className="focus:ring-0 active:ring-0 flex-shrink-0"
            />

            <div 
                ref={parentRef} 
                className="flex-1 overflow-auto rounded-md border border-white/5 bg-black/20"
                style={{ minHeight: "300px", maxHeight: "600px" }}
            >
                {flatNodes.length > 0 ? (
                    <div
                        style={{
                            height: `${virtualizer.getTotalSize()}px`,
                            width: "100%",
                            position: "relative",
                        }}
                    >
                        {virtualItems.map((virtualRow) => {
                            const node = flatNodes[virtualRow.index]
                            const isOpen = expandedPaths.has(node.path)

                            const isFileSelected = !!(node.type === "file" && node.filePreview && selectedIndices.includes(getFileValue(node.filePreview)))
                            const dirState = node.type === "directory" ? getDirectorySelectionState(node) : { isSelected: false, isPartial: false, directoryFileIndices: [] }

                            return (
                                <FileTreeMultiRow
                                    key={virtualRow.key}
                                    node={node}
                                    virtualRow={virtualRow}
                                    isOpen={isOpen}
                                    isFileSelected={isFileSelected}
                                    dirState={dirState}
                                    getFileValue={getFileValue}
                                    selectedIndices={selectedIndices}
                                    onSelectionChange={onSelectionChange}
                                    toggleOpen={toggleOpen}
                                />
                            )
                        })}
                    </div>
                ) : debouncedSearchTerm.trim() ? (
                    <div className="text-center py-8 text-[--muted]">
                        <FiSearch className="mx-auto mb-2 size-8 opacity-50" />
                        <p>No files found matching "{debouncedSearchTerm}"</p>
                    </div>
                ) : null}
            </div>
        </div>
    )
}
