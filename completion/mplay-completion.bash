# Bash completion script for playmusic CLI
# Place in /etc/bash_completion.d/ or ~/.bash_completion.d/

_mplay() {
  local cur prev opts commands

  COMPREPLY=()
  cur="${COMP_WORDS[COMP_CWORD]}"
  prev="${COMP_WORDS[COMP_CWORD-1]}"

  # Define commands and options
  commands="help"
  options="-v --version -h --help -s --stop -p --pause -r --resume -n --next --prev -q --queue --on-end --volume --status --history --clear-cache --cache-status"
  onend_modes="stop next loop queue"

  # Check if we're completing an option or a search query
  if [[ "${cur}" == -* ]]; then
    # Completing an option
    COMPREPLY=( $(compgen -W "${options}" -- "${cur}") )
    return 0
  fi

  # Check if previous word was an option that takes an argument
  case "${prev}" in
    --on-end)
      COMPREPLY=( $(compgen -W "${onend_modes}" -- "${cur}") )
      return 0
      ;;
    --volume)
      # Suggest common volume levels
      COMPREPLY=( $(compgen -W "0 25 50 75 100" -- "${cur}") )
      return 0
      ;;
    -v|--version|-h|--help|-s|--stop|-p|--pause|-r|--resume|-n|--next|--prev|--status|--history|--clear-cache|--cache-status)
      # These options don't take arguments, so no completion
      return 0
      ;;
    -q|--queue)
      # This takes a search query, no specific completion
      return 0
      ;;
  esac

  # If first argument, suggest options or commands
  if [[ ${COMP_CWORD} -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "${options} ${commands}" -- "${cur}") )
    return 0
  fi

  # Default: completing search query (no suggestions)
  return 0
}

# Register completion function
complete -F _mplay mplay

# Usage instructions:
# 1. Copy this file to /etc/bash_completion.d/mplay
#    sudo cp play-completion.bash /etc/bash_completion.d/mplay
#
# 2. Or source it from ~/.bashrc:
#    source /path/to/play-completion.bash
#
# 3. Reload bash:
#    source ~/.bashrc
#
# After installation, type 'mplay --' and press Tab for completions
