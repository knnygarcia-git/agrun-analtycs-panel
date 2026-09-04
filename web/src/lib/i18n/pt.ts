/* Dicionário PT — fonte da verdade. Chaves planas "area.nome".
   O que fica SEMPRE em português (decisão do coach): rascunhos de feedback da
   IA, nomes de alunos, e texto vindo das planilhas (descrição de zona, estrutura
   do treino, tipo, e as notas de validação da planilha). */

export const pt = {
  // genéricos
  "common.loading": "Carregando…",
  "common.cancel": "Cancelar",
  "common.save": "Salvar",
  "common.saving": "Salvando…",
  "common.back": "Voltar",
  "common.backToPanel": "Painel",
  "common.backToAthlete": "Voltar ao aluno",
  "common.dangerZone": "Zona de perigo",
  "common.none": "Selecione…",
  "common.dash": "—",
  "common.delete": "Apagar",

  // navegação / sidebar
  "nav.subtitle": "Painel de revisão de treinos",
  "nav.newAthlete": "Novo aluno",
  "nav.importPlan": "Importar planilha",
  "nav.importFit": "Importar .FIT",
  "nav.signOut": "Sair",
  "nav.loadError": "Erro ao carregar: {msg}",
  "nav.noAthletes": "Nenhum aluno cadastrado ainda.",
  "nav.language": "Idioma",

  // login
  "login.subtitle": "Painel de revisão de treinos",
  "login.email": "E-mail",
  "login.password": "Senha",
  "login.enter": "Entrar",
  "login.entering": "Entrando…",
  "login.badCredentials": "E-mail ou senha incorretos.",
  "login.notConfirmed": "E-mail ainda não confirmado.",

  // home
  "home.title": "Painel AGRUN",
  "home.subtitle": "Revisão e aprovação de feedbacks de treino",
  "home.start": "Começar",
  "home.startHint":
    "depois importe a planilha de um ciclo. Feito isso, importe o resultado (.FIT) de cada treino e gere o feedback.",
  "home.startHintNewAthlete": "Cadastre um aluno",

  // aluno — detalhe
  "aluno.noGoal": "sem objetivo definido",
  "aluno.notFound": "Aluno não encontrado.",
  "aluno.editAthlete": "Editar aluno",
  "aluno.importPlan": "Importar planilha",
  "aluno.importFit": "Importar .FIT",
  "aluno.noCycle": "Nenhum ciclo importado.",
  "aluno.cycle": "Ciclo",
  "aluno.editCycleZones": "Editar ciclo / zonas",
  "aluno.ftpPace": "FTP pace",
  "aluno.testDate": "Data do teste",
  "aluno.zonesTitle": "Zonas - Pace (min/km)",
  "aluno.colZone": "Zona",
  "aluno.colFast": "Rápido",
  "aluno.colSlow": "Lento",
  "aluno.colDescription": "Descrição",
  "aluno.max": "máx",
  "aluno.cycleWorkoutsTitle": "{count} treinos do ciclo",
  "aluno.colWorkout": "Treino",
  "aluno.colWeek": "Sem.",
  "aluno.colType": "Tipo",
  "aluno.colDuration": "Duração",
  "aluno.colVolume": "Volume (km)",
  "aluno.colStructure": "Estrutura",
  "aluno.colExecution": "Execução",
  "aluno.importFitShort": "importar .FIT",
  "aluno.reviewed": "avaliado",

  // novo aluno
  "novoAluno.title": "Novo aluno",
  "novoAluno.name": "Nome",
  "novoAluno.goal": "Objetivo atual",
  "novoAluno.goalPlaceholder": "ex: prova de 21km em novembro",
  "novoAluno.notes": "Observações do coach",
  "novoAluno.notesPlaceholder":
    "histórico, lesões, contexto — entra no prompt de feedback",
  "novoAluno.saveAthlete": "Salvar aluno",

  // editar aluno
  "editarAluno.title": "Editar aluno",
  "editarAluno.confirmDelete":
    'Apagar "{nome}" e TODOS os ciclos, treinos e feedbacks dele? Não dá para desfazer.',
  "editarAluno.deleteAthlete": "Apagar este aluno",

  // editar ciclo
  "editarCiclo.title": "Editar ciclo",
  "editarCiclo.subtitle": "Ajustes manuais sem reimportar a planilha.",
  "editarCiclo.notFound": "Ciclo não encontrado.",
  "editarCiclo.cycle": "Ciclo",
  "editarCiclo.goal": "Objetivo",
  "editarCiclo.sequence": "Sequência",
  "editarCiclo.ftpPace": "FTP pace (M:SS)",
  "editarCiclo.startDate": "Data de início",
  "editarCiclo.endDate": "Data de fim",
  "editarCiclo.thresholdTestDate": "Data do teste de limiar",
  "editarCiclo.zonesTitle": "Zonas - Pace (M:SS por km)",
  "editarCiclo.colZone": "Zona",
  "editarCiclo.colFast": "Rápido",
  "editarCiclo.colSlow": "Lento",
  "editarCiclo.z5Placeholder": "(vazio = máx)",
  "editarCiclo.badFast": '{zona}: pace rápido inválido ("{valor}"). Use M:SS.',
  "editarCiclo.badSlow": '{zona}: pace lento inválido ("{valor}"). Use M:SS.',
  "editarCiclo.badFtp": 'FTP pace inválido ("{valor}"). Use M:SS.',
  "editarCiclo.confirmDelete":
    'Apagar o ciclo "{objetivo} #{seq}"? Isso remove as 5 zonas, os treinos planejados e desvincula as execuções importadas.',
  "editarCiclo.deleteCycle": "Apagar este ciclo",

  // importar planilha
  "importPlan.title": "Importar planilha",
  "importPlan.subtitle":
    "Lê o ciclo, as zonas e os treinos de uma aba Nkm Planilha NN.",
  "importPlan.step1": "1. Aluno + arquivo",
  "importPlan.step2": "2. Escolher ciclo",
  "importPlan.step3": "3. Conferir e confirmar",
  "importPlan.noSheetFound":
    'Nenhuma aba no padrão "Nkm Planilha NN" (ex: "5km Planilha 01", "21km Planilha 02") encontrada neste arquivo.',
  "importPlan.readError": "Não consegui ler o arquivo: {msg}",
  "importPlan.athlete": "Aluno",
  "importPlan.noAthletes": "Nenhum aluno cadastrado.",
  "importPlan.registerFirst": "Cadastre um aluno",
  "importPlan.registerFirstTail": "antes de importar.",
  "importPlan.file": "Arquivo .xlsx",
  "importPlan.chooseAthleteFirst": "Escolha o aluno primeiro.",
  "importPlan.fileAthleteLine": "{arquivo} · aluno: {nome}",
  "importPlan.whichCycle": "Qual ciclo importar? ({count} aba{plural})",
  "importPlan.changeFile": "Trocar arquivo",
  "importPlan.nameMismatch":
    'O nome na planilha ("{planilha}") não parece com o aluno selecionado ("{aluno}"). Nada será sobrescrito — confirme que é a planilha certa.',
  "importPlan.periodOverlap":
    "Período se sobrepõe a um ciclo já importado deste aluno ({objetivo} #{seq}, {inicio} a {fim}).",
  "importPlan.saveError": "Falha ao salvar: {msg}",
  "importPlan.confirmImport": "Confirmar importação",
  "importPlan.cycleImported": "Ciclo importado. Redirecionando…",

  // conferência do ciclo (planilha)
  "confCiclo.error": "ERRO",
  "confCiclo.warning": "AVISO",
  "confCiclo.sheet": "Aba",
  "confCiclo.goalSeq": "Objetivo · seq",
  "confCiclo.period": "Período",
  "confCiclo.ftpPace": "FTP pace",
  "confCiclo.hasErrors":
    "Há campos com erro (destacados abaixo). Corrija na planilha e reimporte — a importação fica bloqueada até resolver.",
  "confCiclo.noErrors":
    "Leitura sem erros críticos. Confira os valores abaixo antes de confirmar.",
  "confCiclo.cycleHeader": "Cabeçalho do ciclo",
  "confCiclo.colField": "Campo",
  "confCiclo.colValueRead": "Valor lido",
  "confCiclo.colCell": "Célula",
  "confCiclo.colCells": "Células",
  "confCiclo.colStatus": "Status",
  "confCiclo.rowAthleteName": "Nome do aluno (planilha)",
  "confCiclo.rowGoal": "Objetivo",
  "confCiclo.rowSequence": "Sequência",
  "confCiclo.rowStartDate": "Data de início",
  "confCiclo.rowEndDate": "Data de fim",
  "confCiclo.rowFtpPace": "FTP pace",
  "confCiclo.rowTestDate": "Data do teste",
  "confCiclo.zonesTitle": "Zonas (pace)",
  "confCiclo.colZone": "Zona",
  "confCiclo.colFastSlow": "Rápido → Lento",
  "confCiclo.max": "máx",
  "confCiclo.workoutsTitle": "{count} treinos",
  "confCiclo.colWorkout": "Treino",
  "confCiclo.colWeek": "Sem.",
  "confCiclo.colType": "Tipo",
  "confCiclo.colDuration": "Duração",
  "confCiclo.colVolume": "Volume (km)",
  "confCiclo.colStructure": "Estrutura",

  // importar .FIT
  "importFit.title": "Importar resultado (.FIT)",
  "importFit.subtitle":
    "Casa o arquivo com um treino do plano e calcula as etapas.",
  "importFit.readError": "Não consegui ler o arquivo: {msg}",
  "importFit.athlete": "Aluno",
  "importFit.noAthletes": "Nenhum aluno cadastrado.",
  "importFit.registerFirst": "Cadastre um aluno",
  "importFit.registerFirstTail": "antes.",
  "importFit.fileLabel": "Arquivo .FIT de resultado",
  "importFit.reading": "Lendo o arquivo…",
  "importFit.readingProgress": "Lendo treino {i} de {total}…",
  "importFit.chooseAthleteFirst": "Escolha o aluno primeiro.",
  "importFit.accepts":
    "Aceita o .FIT, o .FIT.gz ou o .zip de vários treinos baixado do TrainingPeaks (sem precisar extrair).",
  "importFit.saveError": "Falha ao salvar: {msg}",
  "importFit.confirmProcess": "Confirmar e processar",
  "importFit.confirmManualProcess": "Confirmar manualmente e processar",
  "importFit.replacePrompt":
    "Já existe uma execução importada para {codigo} ({data}). Substituir pela nova?",
  "importFit.processed": "Treino processado. Redirecionando…",

  // conferência de 1 treino (.FIT)
  "confFit.fileWorkout": "Treino (arquivo)",
  "confFit.executionDate": "Data de execução",
  "confFit.realDuration": "Duração real",
  "confFit.planned": "Planejada",
  "confFit.difference": "Diferença",
  "confFit.matchWith": "Casar com o treino planejado",
  "confFit.stageComparisonTitle": "Plano × realizado — por etapa",
  "confFit.stagesOutOfZone_one":
    "{count} etapa caiu fora da zona planejada (destacada abaixo). Zona calculada da tabela do aluno, não do arquivo.",
  "confFit.stagesOutOfZone_other":
    "{count} etapas caíram fora da zona planejada (destacadas abaixo). Zona calculada da tabela do aluno, não do arquivo.",
  "confFit.allInZone": "Todas as etapas caíram dentro da zona planejada.",
  "confFit.zoneByOrder":
    "Esse relógio não registra a estrutura do treino (comum fora do Garmin/TrainingPeaks) — a zona planejada de cada etapa foi estimada pela ordem das voltas, não por um vínculo direto do arquivo.",

  // nomes de etapa (gerados pelo código, não vêm da planilha)
  "etapa.warmup": "Aquecimento",
  "etapa.active": "Ativo",
  "etapa.cooldown": "Esfriar",
  "etapa.interval": "Intervalo",
  "etapa.recovery": "Recuperação",
  "etapa.generic": "Etapa",
  "etapa.km": "km {n}",
  "etapa.rest": "resto",

  // tabela de etapas (compartilhada)
  "etapas.stage": "Etapa",
  "etapas.start": "Início",
  "etapas.end": "Fim",
  "etapas.duration": "Duração",
  "etapas.km": "Km",
  "etapas.pace": "Pace",
  "etapas.zone": "Zona",
  "etapas.plan": "Plano",
  "etapas.inRange": "Na faixa",
  "etapas.hrMinAvgMax": "FC mín/méd/máx",
  "etapas.cadAvgMax": "Cad. méd/máx",
  "etapas.cadAvg": "Cad. méd",
  "etapas.elevMinAvgMax": "Elevação mín/méd/máx (m)",

  // importação em lote (.zip)
  "lote.summary":
    "{total} treino{pluralTotal} no arquivo · {marcados} marcado{pluralMarcados} para importar",
  "lote.summaryReview": " · {count} para revisar",
  "lote.summaryReplaceOne": " · 1 já existe e será substituído",
  "lote.summaryReplaceMany": " · {count} já existem e serão substituídos",
  "lote.result_one": "{count} importado.",
  "lote.result_other": "{count} importados.",
  "lote.resultWithFails_one": "{ok} importado, {fail} com falha.",
  "lote.resultWithFails_other": "{ok} importados, {fail} com falha.",
  "lote.colCheck": "✓",
  "lote.colWorkout": "Treino",
  "lote.colDate": "Data",
  "lote.colRealPlan": "Real / plano",
  "lote.colMatchWith": "Casar com o treino planejado",
  "lote.colStatus": "Situação",
  "lote.stages": "etapas",
  "lote.close": "fechar",
  "lote.saving": "salvando…",
  "lote.imported": "✓ importado",
  "lote.failed": "✗ {msg}",
  "lote.failedGeneric": "falhou",
  "lote.noWorkoutChosen": "nenhum treino escolhido",
  "lote.matchedAuto": "casou automático",
  "lote.reviewFirst": "revisar antes",
  "lote.replaceSuffix": " · já existe, vai substituir",
  "lote.noPlanMatch": "sem treino no plano — escolha ou pule",
  "lote.notRunning": "não é corrida — ignorado",
  "lote.duplicateWarning":
    "{count} linhas estão casadas com o mesmo treino do plano — a última sobrescreveria a anterior. Escolha outro treino ou desmarque uma delas antes de importar.",
  "lote.duplicateInBatch": "duplicado neste lote — corrija antes de importar",
  "lote.detailRealDuration": "Duração real",
  "lote.detailPlanned": "Planejada",
  "lote.detailDifference": "Diferença",
  "lote.detailStagesOutOfZone": "Etapas fora da zona",
  "lote.noStages":
    "Sem etapas para mostrar (escolha um treino do plano para comparar).",
  "lote.importN_one": "Importar {count} treino",
  "lote.importN_other": "Importar {count} treinos",
  "lote.importing": "Importando…",
  "lote.done": "Concluir",

  // treino — detalhe
  "treino.notFound": "Treino não encontrado.",
  "treino.workoutFallback": "Treino",
  "treino.removeExecution": "Remover execução",
  "treino.confirmRemove":
    "Remover esta execução (etapas + feedback + arquivo .FIT)? O treino planejado continua no ciclo.",
  "treino.realDuration": "Duração real",
  "treino.planned": "Planejada",
  "treino.difference": "Diferença",
  "treino.match": "Casamento",
  "treino.matchAuto": "Automático",
  "treino.matchManual": "Manual",
  "treino.matchReview": "A revisar",
  "treino.reviewed": "Avaliado",
  "treino.reviewedYesSent": "Sim (feedback enviado)",
  "treino.reviewedYesManual": "Sim",
  "treino.reviewedNo": "Não",
  "treino.markReviewed": "Marcar como avaliado",
  "treino.unmarkReviewed": "Desmarcar avaliado",
  "treino.paceHrTitle": "Perfil do treino",
  "treino.chartReprocessError":
    "Não consegui reprocessar o gráfico deste arquivo ({msg}). A tabela por etapa abaixo continua válida.",
  "treino.reprocessing": "Reprocessando o arquivo…",
  "treino.stageComparisonTitle": "Plano × realizado — por etapa",
  "treino.feedbackTitle": "Feedback",

  // gráficos
  "grafico.pace": "Ritmo",
  "grafico.hr": "Freq. cardíaca",
  "grafico.cadence": "Cadência",
  "grafico.altitude": "Altitude",
  "grafico.max": "Máx",
  "grafico.avg": "Méd",
  "grafico.min": "Mín",
  "grafico.perKm": "/km",
  "grafico.bpm": "bpm",
  "grafico.spm": "spm",
  "grafico.meters": "m",
  "grafico.noSeries": "Sem série de dados no arquivo.",
  "grafico.noPaceSeries": "Sem série de ritmo neste arquivo.",
  "grafico.zone": "zona {z}",
  "grafico.planVsReal": "Ritmo planejado × realizado",
  "grafico.time": "Tempo",
  "grafico.distance": "Distância",
  "grafico.paceLabel": "Ritmo",
  "grafico.hrLabel": "FC",
  "grafico.planLabel": "Plano: {zona} ({rapido}–{lento})",
  "grafico.legendReal": "realizado",
  "grafico.legendPlanned": "faixa planejada (por zona)",

  // feedback
  "feedback.statusPendente": "AGUARDANDO RASCUNHO",
  "feedback.statusRascunho": "RASCUNHO — REVISAR",
  "feedback.statusAprovado": "APROVADO",
  "feedback.statusEnviado": "ENVIADO",
  "feedback.loading": "Carregando feedback…",
  "feedback.draftGeneratedAt": "rascunho gerado em {data}",
  "feedback.noDraft": "Nenhum rascunho para este treino.",
  "feedback.generate": "Gerar rascunho",
  "feedback.generating": "Gerando…",
  "feedback.modelNoText": "O modelo não devolveu texto.",
  "feedback.labelSent": "Enviado ao aluno",
  "feedback.labelApproved":
    "Aprovado pelo coach — revise antes de marcar como enviado",
  "feedback.labelDraft": "Rascunho da IA — edite à vontade antes de aprovar",
  "feedback.approve": "Aprovar",
  "feedback.regenerate": "Gerar novo rascunho",
  "feedback.discard": "Descartar",
  "feedback.markSent": "Marcar como enviado ao aluno",
  "feedback.backToDraft": "Voltar para rascunho",
  "feedback.sentAt": "✓ Enviado em {data} — copie o texto acima para o TrainingPeaks.",
  "feedback.sentNoDate": "✓ Enviado — copie o texto acima para o TrainingPeaks.",

  // casamento (match.ts) — motivo
  "match.noCodeInFile":
    "Não achei um código T01–T16 no nome do treino do arquivo. Escolha o treino manualmente.",
  "match.noCodeGuessed":
    "O relógio não gravou o nome do treino (comum fora do Garmin/TrainingPeaks). Pré-selecionei {codigo} pela data ({data}) e pela duração — confira se é esse mesmo antes de confirmar.",
  "match.notRunning":
    "Essa atividade não é corrida (esporte: {esporte}) — não tenta casar sozinha com nenhum treino do plano.",
  "match.noCodeNoGoodGuess":
    "Não achei nenhum treino do plano com duração parecida com esse arquivo (pode ser um trote avulso, fora do plano). Escolha manualmente se quiser vincular a um treino.",
  "match.codeNoCycleCovers":
    "Existe {codigo} no plano do aluno, mas nenhum ciclo cobre a data {data}. Escolha manualmente.",
  "match.noCodeInPlan": "Nenhum {codigo} no plano do aluno. Escolha manualmente.",
  "match.multipleCycles":
    "{count} ciclos cobrem a data {data} com um {codigo}. Confirme qual é o certo.",
  "match.noPlanDuration":
    "{codigo} casou por data, mas o plano não tem duração para comparar. Revise antes de processar.",
  "match.autoOk":
    "{codigo} · duração bate dentro de {tol}% ({diff}%).",
  "match.durationDiverges":
    "{codigo} casou por data, mas a duração diverge {diff}% do planejado. Pode ser outro treino de nome parecido — confirme antes de processar.",

  // evolução — teste de 3km
  "teste3km.title": "Evolução - Teste de 3km",
  "teste3km.addNew": "+ Novo teste",
  "teste3km.date": "Data",
  "teste3km.time": "Tempo (M:SS)",
  "teste3km.ftpResult": "FTP pace (M:SS/km)",
  "teste3km.notes": "Observações",
  "teste3km.notesPlaceholder": "vento forte, pista molhada, etc.",
  "teste3km.empty":
    "Nenhum teste de 3km registrado ainda. Registre o primeiro pra começar a acompanhar a evolução.",
  "teste3km.chartTime": "Tempo do teste",
  "teste3km.chartFtp": "FTP pace resultante",
  "teste3km.confirmarApagar": "Apagar este teste de 3km? Não dá pra desfazer.",
  "teste3km.erroCampos": "Preencha a data e o tempo do teste.",
  "teste3km.erroFtp": 'FTP pace inválido. Use M:SS (ex: "4:15").',
} as const;

export type TKey = keyof typeof pt;
