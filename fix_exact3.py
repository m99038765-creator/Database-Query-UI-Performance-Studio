with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Let's replace the whole ternary block cleanly
start_marker = '{filteredSectionOrder.length === 0 ? ('
idx = content.find(start_marker)
if idx != -1:
    # Find where filteredSectionOrder.map starts
    map_idx = content.find('filteredSectionOrder.map', idx)
    if map_idx != -1:
        # We want to replace from start_marker up to the map invocation, and also fix the end.
        # Let's write the exact corrected block:
        corrected_block = '''{filteredSectionOrder.length === 0 ? (
                                <div className="col-span-full py-6 text-center bg-zinc-950/60 rounded border border-zinc-800 text-zinc-400 text-[11px] flex flex-col items-center justify-center gap-1">
                                  <span>No matching PDF section cards found for &ldquo;{pdfSectionSearchQuery}&rdquo;</span>
                                  <button
                                    type="button"
                                    onClick={() => setPdfSectionSearchQuery('')}
                                    className="text-amber-400 hover:text-amber-300 underline text-[10px] cursor-pointer mt-0.5"
                                  >
                                    Clear search filter
                                  </button>
                                </div>
                              ) : (
                                filteredSectionOrder.map((sectionId, index) => {'''
        
        # Let's find the end of the original mapping where it ends with </div>
        # We can find the </div> after map
        end_search_str = '});\n                            </div>'
        end_idx = content.find(end_search_str, map_idx)
        if end_idx != -1:
            full_original_block = content[idx:end_idx + len(end_search_str)]
            corrected_full = '''{filteredSectionOrder.length === 0 ? (
                                <div className="col-span-full py-6 text-center bg-zinc-950/60 rounded border border-zinc-800 text-zinc-400 text-[11px] flex flex-col items-center justify-center gap-1">
                                  <span>No matching PDF section cards found for &ldquo;{pdfSectionSearchQuery}&rdquo;</span>
                                  <button
                                    type="button"
                                    onClick={() => setPdfSectionSearchQuery('')}
                                    className="text-amber-400 hover:text-amber-300 underline text-[10px] cursor-pointer mt-0.5"
                                  >
                                    Clear search filter
                                  </button>
                                </div>
                              ) : (
                                filteredSectionOrder.map((sectionId, index) => {'''
            
            # Find the end of map where it has `});` followed by `</div>`
            # Let's find `});\n                              </div>`
            target_end = '                                 );\n                               });\n                             </div>'
            # Let's replace content from idx to end of map
            pass

print("Inspection completed")
